import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { generateApiKeySecret, sha256Hex } from '../security/utils/security-hash.util';
import {
  ExchangeOAuthTokenDto,
  IntrospectOAuthTokenDto,
  OAuthIntrospectResponseDto,
  OAuthTokenResponseDto,
  RevokeOAuthTokenDto,
} from './dto/oauth-token.dto';
import { OAuthApplicationEntity } from './entities/oauth-application.entity';
import { OAuthTokenPairEntity } from './entities/oauth-token.entity';
import { OAuthWireException } from './errors/oauth-wire.exception';
import { OAuthApplicationRepository } from './oauth-application.repository';
import { OAuthAuthorizationCodeRepository } from './oauth-authorization-code.repository';
import { OAuthTokenRepository } from './oauth-token.repository';
import { verifyPkce } from './utils/pkce.util';

@Injectable()
export class OAuthTokenService {
  constructor(
    private readonly applicationRepository: OAuthApplicationRepository,
    private readonly authorizationCodeRepository: OAuthAuthorizationCodeRepository,
    private readonly tokenRepository: OAuthTokenRepository,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async exchangeToken(dto: ExchangeOAuthTokenDto): Promise<OAuthTokenResponseDto> {
    const application = await this.authenticateClient(dto.client_id, dto.client_secret);

    if (dto.grant_type === 'authorization_code') {
      return this.exchangeAuthorizationCode(application, dto);
    }
    return this.refresh(application, dto);
  }

  /** RFC 7009 §2.1 — always behaves as if the token was found and revoked,
   * even when it wasn't (or belongs to a different client), so a response
   * timing/shape difference can never be used as a token-scanning oracle. */
  async revoke(dto: RevokeOAuthTokenDto): Promise<void> {
    const application = await this.authenticateClient(dto.client_id, dto.client_secret);
    const tokenHash = sha256Hex(dto.token);

    const accessToken = await this.tokenRepository.findAccessTokenByHashForApplication(
      tokenHash,
      application.id,
    );
    if (accessToken && !accessToken.revokedAt) {
      await this.tokenRepository.revokeAccessToken(accessToken.id);
      await this.auditService.recordWithExplicitActor({
        organizationId: accessToken.authorizingOrganizationId,
        userId: accessToken.authorizingUserId,
        action: 'oauth_application.token_revoked',
        resource: 'oauth_application',
        resourceId: application.id,
      });
      return;
    }

    const refreshToken = await this.tokenRepository.findRefreshTokenByHashForApplication(
      tokenHash,
      application.id,
    );
    if (refreshToken && !refreshToken.revokedAt) {
      await this.tokenRepository.revokeRefreshToken(refreshToken.id);
      await this.tokenRepository.revokeAccessToken(refreshToken.accessTokenId);
      await this.auditService.recordWithExplicitActor({
        organizationId: refreshToken.authorizingOrganizationId,
        userId: refreshToken.authorizingUserId,
        action: 'oauth_application.token_revoked',
        resource: 'oauth_application',
        resourceId: application.id,
      });
    }
  }

  /** RFC 7662 — an application may only introspect tokens it itself
   * issued; a token belonging to another application is reported inactive,
   * never leaking whether it exists. */
  async introspect(dto: IntrospectOAuthTokenDto): Promise<OAuthIntrospectResponseDto> {
    const application = await this.authenticateClient(dto.client_id, dto.client_secret);
    const tokenHash = sha256Hex(dto.token);

    const accessToken = await this.tokenRepository.findAccessTokenByHashForApplication(
      tokenHash,
      application.id,
    );
    if (accessToken && !accessToken.revokedAt && accessToken.expiresAt.getTime() > Date.now()) {
      return {
        active: true,
        scope: accessToken.scopes.join(' '),
        client_id: application.clientId,
        sub: accessToken.authorizingUserId,
        exp: Math.floor(accessToken.expiresAt.getTime() / 1000),
        iat: Math.floor(accessToken.createdAt.getTime() / 1000),
        token_type: 'access_token',
      };
    }

    const refreshToken = await this.tokenRepository.findRefreshTokenByHashForApplication(
      tokenHash,
      application.id,
    );
    if (refreshToken && !refreshToken.revokedAt && refreshToken.expiresAt.getTime() > Date.now()) {
      return {
        active: true,
        scope: refreshToken.scopes.join(' '),
        client_id: application.clientId,
        sub: refreshToken.authorizingUserId,
        exp: Math.floor(refreshToken.expiresAt.getTime() / 1000),
        iat: Math.floor(refreshToken.createdAt.getTime() / 1000),
        token_type: 'refresh_token',
      };
    }

    return { active: false };
  }

  private async authenticateClient(
    clientId: string,
    clientSecret: string,
  ): Promise<OAuthApplicationEntity> {
    const application = await this.applicationRepository.findActiveByClientId(clientId);
    if (!application || application.clientSecretHash !== sha256Hex(clientSecret)) {
      throw new OAuthWireException(
        HttpStatus.UNAUTHORIZED,
        'invalid_client',
        'Unknown client or invalid client secret',
      );
    }
    return application;
  }

  private async exchangeAuthorizationCode(
    application: OAuthApplicationEntity,
    dto: ExchangeOAuthTokenDto,
  ): Promise<OAuthTokenResponseDto> {
    if (!dto.code || !dto.redirect_uri || !dto.code_verifier) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'code, redirect_uri, and code_verifier are required for the authorization_code grant',
      );
    }

    const code = await this.authorizationCodeRepository.findActiveByHash(sha256Hex(dto.code));
    if (!code || code.applicationId !== application.id) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_grant',
        'Authorization code is invalid, expired, or already used',
      );
    }

    if (code.redirectUri !== dto.redirect_uri) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_grant',
        'redirect_uri does not match the one used to obtain this code',
      );
    }

    if (!verifyPkce(dto.code_verifier, code.codeChallenge)) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_grant',
        'code_verifier does not match the code_challenge',
      );
    }

    const consumed = await this.authorizationCodeRepository.tryConsume(code.id);
    if (!consumed) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_grant',
        'Authorization code has already been used',
      );
    }

    const pair = await this.issueTokenPair(
      application.id,
      code.authorizingUserId,
      code.authorizingOrganizationId,
      code.scopes,
    );

    await this.auditService.recordWithExplicitActor({
      organizationId: code.authorizingOrganizationId,
      userId: code.authorizingUserId,
      action: 'oauth_application.token_issued',
      resource: 'oauth_application',
      resourceId: application.id,
      metadata: { grantType: 'authorization_code', scopes: code.scopes },
    });

    return this.toTokenResponse(pair);
  }

  private async refresh(
    application: OAuthApplicationEntity,
    dto: ExchangeOAuthTokenDto,
  ): Promise<OAuthTokenResponseDto> {
    if (!dto.refresh_token) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_request',
        'refresh_token is required for the refresh_token grant',
      );
    }

    const refreshToken = await this.tokenRepository.findActiveRefreshTokenByHash(
      sha256Hex(dto.refresh_token),
    );
    if (!refreshToken || refreshToken.applicationId !== application.id) {
      throw new OAuthWireException(
        HttpStatus.BAD_REQUEST,
        'invalid_grant',
        'Refresh token is invalid, expired, or revoked',
      );
    }

    // Rotation on use: the presented refresh token and its paired access
    // token are revoked immediately so neither can be replayed, and a
    // brand-new pair is issued — current OAuth best practice, stronger
    // than RFC 6749's baseline.
    await this.tokenRepository.revokeRefreshToken(refreshToken.id);
    await this.tokenRepository.revokeAccessToken(refreshToken.accessTokenId);

    const pair = await this.issueTokenPair(
      application.id,
      refreshToken.authorizingUserId,
      refreshToken.authorizingOrganizationId,
      refreshToken.scopes,
    );

    await this.auditService.recordWithExplicitActor({
      organizationId: refreshToken.authorizingOrganizationId,
      userId: refreshToken.authorizingUserId,
      action: 'oauth_application.token_refreshed',
      resource: 'oauth_application',
      resourceId: application.id,
    });

    return this.toTokenResponse(pair);
  }

  private async issueTokenPair(
    applicationId: string,
    authorizingUserId: string,
    authorizingOrganizationId: string,
    scopes: string[],
  ): Promise<
    OAuthTokenPairEntity & {
      rawAccessToken: string;
      rawRefreshToken: string;
      accessTokenTtlSeconds: number;
    }
  > {
    const accessTokenPrefixConfig = this.configService.get<string>(
      'developerPlatform.oauthAccessTokenPrefix',
      'voat',
    );
    const refreshTokenPrefixConfig = this.configService.get<string>(
      'developerPlatform.oauthRefreshTokenPrefix',
      'vort',
    );
    const accessTokenTtlSeconds = this.configService.get<number>(
      'developerPlatform.oauthAccessTokenTtlSeconds',
      3600,
    );
    const refreshTokenTtlSeconds = this.configService.get<number>(
      'developerPlatform.oauthRefreshTokenTtlSeconds',
      2592000,
    );

    const accessSecret = generateApiKeySecret();
    const rawAccessToken = `${accessTokenPrefixConfig}_${accessSecret}`;
    const refreshSecret = generateApiKeySecret();
    const rawRefreshToken = `${refreshTokenPrefixConfig}_${refreshSecret}`;

    const pair = await this.tokenRepository.createPair({
      applicationId,
      authorizingUserId,
      authorizingOrganizationId,
      scopes,
      accessTokenHash: sha256Hex(rawAccessToken),
      accessTokenPrefix: `${accessTokenPrefixConfig}_${accessSecret.slice(0, 8)}...`,
      accessTokenExpiresAt: new Date(Date.now() + accessTokenTtlSeconds * 1000),
      refreshTokenHash: sha256Hex(rawRefreshToken),
      refreshTokenExpiresAt: new Date(Date.now() + refreshTokenTtlSeconds * 1000),
    });

    return { ...pair, rawAccessToken, rawRefreshToken, accessTokenTtlSeconds };
  }

  private toTokenResponse(
    pair: OAuthTokenPairEntity & {
      rawAccessToken: string;
      rawRefreshToken: string;
      accessTokenTtlSeconds: number;
    },
  ): OAuthTokenResponseDto {
    return {
      access_token: pair.rawAccessToken,
      token_type: 'Bearer',
      expires_in: pair.accessTokenTtlSeconds,
      refresh_token: pair.rawRefreshToken,
      scope: pair.accessToken.scopes.join(' '),
    };
  }
}
