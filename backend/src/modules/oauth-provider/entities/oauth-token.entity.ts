import { OAuthAccessToken, OAuthAuthorizationCode, OAuthRefreshToken } from '@prisma/client';

export interface OAuthAuthorizationCodeEntity {
  id: string;
  applicationId: string;
  authorizingUserId: string;
  authorizingOrganizationId: string;
  codeHash: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: Date;
  consumedAt: Date | null;
  createdAt: Date;
}

export const toOAuthAuthorizationCodeEntity = (
  record: OAuthAuthorizationCode,
): OAuthAuthorizationCodeEntity => ({
  id: record.id,
  applicationId: record.applicationId,
  authorizingUserId: record.authorizingUserId,
  authorizingOrganizationId: record.authorizingOrganizationId,
  codeHash: record.codeHash,
  redirectUri: record.redirectUri,
  scopes: record.scopes,
  codeChallenge: record.codeChallenge,
  codeChallengeMethod: record.codeChallengeMethod,
  expiresAt: record.expiresAt,
  consumedAt: record.consumedAt,
  createdAt: record.createdAt,
});

export interface OAuthAccessTokenEntity {
  id: string;
  applicationId: string;
  authorizingUserId: string;
  authorizingOrganizationId: string;
  tokenHash: string;
  tokenPrefix: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export const toOAuthAccessTokenEntity = (record: OAuthAccessToken): OAuthAccessTokenEntity => ({
  id: record.id,
  applicationId: record.applicationId,
  authorizingUserId: record.authorizingUserId,
  authorizingOrganizationId: record.authorizingOrganizationId,
  tokenHash: record.tokenHash,
  tokenPrefix: record.tokenPrefix,
  scopes: record.scopes,
  expiresAt: record.expiresAt,
  revokedAt: record.revokedAt,
  createdAt: record.createdAt,
});

export interface OAuthRefreshTokenEntity {
  id: string;
  applicationId: string;
  accessTokenId: string;
  authorizingUserId: string;
  authorizingOrganizationId: string;
  tokenHash: string;
  scopes: string[];
  expiresAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export const toOAuthRefreshTokenEntity = (record: OAuthRefreshToken): OAuthRefreshTokenEntity => ({
  id: record.id,
  applicationId: record.applicationId,
  accessTokenId: record.accessTokenId,
  authorizingUserId: record.authorizingUserId,
  authorizingOrganizationId: record.authorizingOrganizationId,
  tokenHash: record.tokenHash,
  scopes: record.scopes,
  expiresAt: record.expiresAt,
  revokedAt: record.revokedAt,
  createdAt: record.createdAt,
});

export interface OAuthTokenPairEntity {
  accessToken: OAuthAccessTokenEntity;
  refreshToken: OAuthRefreshTokenEntity;
}
