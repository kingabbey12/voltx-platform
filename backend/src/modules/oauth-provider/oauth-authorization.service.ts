import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../auth/interfaces/current-user.interface';
import { PermissionRepository } from '../permissions/permission.repository';
import { AuditService } from '../audit/audit.service';
import { sha256Hex } from '../security/utils/security-hash.util';
import {
  DecideOAuthAuthorizationDto,
  OAuthAuthorizeQueryDto,
  OAuthConsentContextResponseDto,
  OAuthDecisionResponseDto,
} from './dto/oauth-authorize.dto';
import { OAuthApplicationWithRedirectUrisEntity } from './entities/oauth-application.entity';
import { OAuthApplicationRepository } from './oauth-application.repository';
import { OAuthAuthorizationCodeRepository } from './oauth-authorization-code.repository';

@Injectable()
export class OAuthAuthorizationService {
  constructor(
    private readonly applicationRepository: OAuthApplicationRepository,
    private readonly authorizationCodeRepository: OAuthAuthorizationCodeRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async getConsentContext(
    query: OAuthAuthorizeQueryDto,
    currentUser: CurrentUser,
  ): Promise<OAuthConsentContextResponseDto> {
    const { application, scopes } = await this.validateRequest(query, currentUser);

    const allPermissions = await this.permissionRepository.findAll();
    const descriptionByKey = new Map(allPermissions.map((p) => [p.key, p.description]));

    return {
      applicationId: application.id,
      applicationName: application.name,
      applicationLogoUrl: application.logoUrl,
      organizationId: currentUser.organizationId,
      redirectUri: query.redirect_uri,
      state: query.state ?? null,
      scopes: scopes.map((key) => ({ key, description: descriptionByKey.get(key) ?? key })),
    };
  }

  async decide(
    dto: DecideOAuthAuthorizationDto,
    currentUser: CurrentUser,
  ): Promise<OAuthDecisionResponseDto> {
    const { application, scopes } = await this.validateRequest(
      {
        client_id: dto.client_id,
        redirect_uri: dto.redirect_uri,
        scope: dto.scope,
        code_challenge: dto.code_challenge,
        code_challenge_method: dto.code_challenge_method,
      },
      currentUser,
    );

    if (dto.decision === 'deny') {
      await this.auditService.record({
        action: 'oauth_application.authorization_denied',
        resource: 'oauth_application',
        resourceId: application.id,
      });
      return {
        redirectUrl: buildRedirectUrl(dto.redirect_uri, {
          error: 'access_denied',
          state: dto.state,
        }),
      };
    }

    const rawCode = randomBytes(32).toString('base64url');
    const ttlSeconds = this.configService.get<number>(
      'developerPlatform.oauthAuthorizationCodeTtlSeconds',
      60,
    );

    await this.authorizationCodeRepository.create({
      applicationId: application.id,
      authorizingUserId: currentUser.id,
      authorizingOrganizationId: currentUser.organizationId,
      codeHash: sha256Hex(rawCode),
      redirectUri: dto.redirect_uri,
      scopes,
      codeChallenge: dto.code_challenge,
      codeChallengeMethod: dto.code_challenge_method,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000),
    });

    await this.auditService.record({
      action: 'oauth_application.authorized',
      resource: 'oauth_application',
      resourceId: application.id,
      metadata: { scopes },
    });

    return {
      redirectUrl: buildRedirectUrl(dto.redirect_uri, { code: rawCode, state: dto.state }),
    };
  }

  /**
   * Re-validated from scratch on every call (never trust that a prior GET
   * happened) — client must exist and be active, the redirect_uri must
   * exactly match a registered URI (never a prefix/pattern match), PKCE
   * must be S256, and the requested scopes must be a subset of both the
   * application's registered scopes and the authorizing user's own live
   * permissions (same can't-exceed-caller rule as every other credential
   * type in this codebase).
   */
  private async validateRequest(
    query: Pick<
      OAuthAuthorizeQueryDto,
      'client_id' | 'redirect_uri' | 'scope' | 'code_challenge' | 'code_challenge_method'
    >,
    currentUser: CurrentUser,
  ): Promise<{ application: OAuthApplicationWithRedirectUrisEntity; scopes: string[] }> {
    const application = await this.applicationRepository.findActiveByClientId(query.client_id);
    if (!application) {
      throw new BadRequestException('Unknown or inactive client_id');
    }

    const redirectUriIsRegistered = application.redirectUris.some(
      (r) => r.uri === query.redirect_uri,
    );
    if (!redirectUriIsRegistered) {
      throw new BadRequestException(
        'redirect_uri does not match any URI registered for this application',
      );
    }

    if (query.code_challenge_method !== 'S256') {
      throw new BadRequestException('Only the S256 PKCE code_challenge_method is supported');
    }
    if (!query.code_challenge) {
      throw new BadRequestException('code_challenge is required');
    }

    const scopes = query.scope.split(/\s+/u).filter((s) => s.length > 0);
    if (scopes.length === 0) {
      throw new BadRequestException('At least one scope is required');
    }

    const notRegisteredForApp = scopes.filter((key) => !application.scopes.includes(key));
    if (notRegisteredForApp.length > 0) {
      throw new BadRequestException(
        `This application is not registered for scope(s): ${notRegisteredForApp.join(', ')}`,
      );
    }

    const notHeldByUser = scopes.filter((key) => !currentUser.permissions.includes(key));
    if (notHeldByUser.length > 0) {
      throw new ForbiddenException(
        `Cannot authorize scope(s) you don't currently hold: ${notHeldByUser.join(', ')}`,
      );
    }

    return { application, scopes };
  }
}

function buildRedirectUrl(redirectUri: string, params: Record<string, string | undefined>): string {
  const url = new URL(redirectUri);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}
