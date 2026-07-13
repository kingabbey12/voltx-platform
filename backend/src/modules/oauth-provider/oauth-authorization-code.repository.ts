import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  OAuthAuthorizationCodeEntity,
  toOAuthAuthorizationCodeEntity,
} from './entities/oauth-token.entity';

export interface CreateOAuthAuthorizationCodeData {
  applicationId: string;
  authorizingUserId: string;
  authorizingOrganizationId: string;
  codeHash: string;
  redirectUri: string;
  scopes: string[];
  codeChallenge: string;
  codeChallengeMethod: string;
  expiresAt: Date;
}

@Injectable()
export class OAuthAuthorizationCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateOAuthAuthorizationCodeData): Promise<OAuthAuthorizationCodeEntity> {
    const record = await this.prisma.system.oAuthAuthorizationCode.create({ data });
    return toOAuthAuthorizationCodeEntity(record);
  }

  async findActiveByHash(codeHash: string): Promise<OAuthAuthorizationCodeEntity | null> {
    const record = await this.prisma.system.oAuthAuthorizationCode.findFirst({
      where: { codeHash, consumedAt: null, expiresAt: { gt: new Date() } },
    });
    return record ? toOAuthAuthorizationCodeEntity(record) : null;
  }

  /**
   * Atomically marks the code consumed via a conditional update — if a
   * concurrent request already consumed it, `count` is 0 and this returns
   * false, so a replayed code can never be redeemed twice even under a
   * race.
   */
  async tryConsume(id: string): Promise<boolean> {
    const result = await this.prisma.system.oAuthAuthorizationCode.updateMany({
      where: { id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return result.count === 1;
  }
}
