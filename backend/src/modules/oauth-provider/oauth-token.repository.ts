import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  OAuthAccessTokenEntity,
  OAuthRefreshTokenEntity,
  OAuthTokenPairEntity,
  toOAuthAccessTokenEntity,
  toOAuthRefreshTokenEntity,
} from './entities/oauth-token.entity';

export interface CreateOAuthTokenPairData {
  applicationId: string;
  authorizingUserId: string;
  authorizingOrganizationId: string;
  scopes: string[];
  accessTokenHash: string;
  accessTokenPrefix: string;
  accessTokenExpiresAt: Date;
  refreshTokenHash: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class OAuthTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPair(data: CreateOAuthTokenPairData): Promise<OAuthTokenPairEntity> {
    return this.prisma.runInTransaction(async (tx) => {
      const accessToken = await tx.oAuthAccessToken.create({
        data: {
          applicationId: data.applicationId,
          authorizingUserId: data.authorizingUserId,
          authorizingOrganizationId: data.authorizingOrganizationId,
          scopes: data.scopes,
          tokenHash: data.accessTokenHash,
          tokenPrefix: data.accessTokenPrefix,
          expiresAt: data.accessTokenExpiresAt,
        },
      });

      const refreshToken = await tx.oAuthRefreshToken.create({
        data: {
          applicationId: data.applicationId,
          accessTokenId: accessToken.id,
          authorizingUserId: data.authorizingUserId,
          authorizingOrganizationId: data.authorizingOrganizationId,
          scopes: data.scopes,
          tokenHash: data.refreshTokenHash,
          expiresAt: data.refreshTokenExpiresAt,
        },
      });

      return {
        accessToken: toOAuthAccessTokenEntity(accessToken),
        refreshToken: toOAuthRefreshTokenEntity(refreshToken),
      };
    });
  }

  async findActiveAccessTokenByHash(tokenHash: string): Promise<OAuthAccessTokenEntity | null> {
    const record = await this.prisma.system.oAuthAccessToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return record ? toOAuthAccessTokenEntity(record) : null;
  }

  /** Unscoped by expiry — RFC 7662 introspection/RFC 7009 revocation must
   * still find an expired-but-not-revoked token to correctly report
   * `active: false` or no-op a revoke, rather than a 404. */
  async findAccessTokenByHashForApplication(
    tokenHash: string,
    applicationId: string,
  ): Promise<OAuthAccessTokenEntity | null> {
    const record = await this.prisma.system.oAuthAccessToken.findFirst({
      where: { tokenHash, applicationId },
    });
    return record ? toOAuthAccessTokenEntity(record) : null;
  }

  async findActiveRefreshTokenByHash(tokenHash: string): Promise<OAuthRefreshTokenEntity | null> {
    const record = await this.prisma.system.oAuthRefreshToken.findFirst({
      where: { tokenHash, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    return record ? toOAuthRefreshTokenEntity(record) : null;
  }

  async findRefreshTokenByHashForApplication(
    tokenHash: string,
    applicationId: string,
  ): Promise<OAuthRefreshTokenEntity | null> {
    const record = await this.prisma.system.oAuthRefreshToken.findFirst({
      where: { tokenHash, applicationId },
    });
    return record ? toOAuthRefreshTokenEntity(record) : null;
  }

  async revokeAccessToken(id: string): Promise<void> {
    await this.prisma.system.oAuthAccessToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.prisma.system.oAuthRefreshToken.updateMany({
      where: { id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
