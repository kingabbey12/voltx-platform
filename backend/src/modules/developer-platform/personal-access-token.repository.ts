import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  PersonalAccessTokenEntity,
  toPersonalAccessTokenEntity,
} from './entities/personal-access-token.entity';

export interface CreatePersonalAccessTokenData {
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopedPermissions: string[];
  expiresAt?: Date;
}

@Injectable()
export class PersonalAccessTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePersonalAccessTokenData): Promise<PersonalAccessTokenEntity> {
    const record = await this.prisma.system.personalAccessToken.create({ data });
    return toPersonalAccessTokenEntity(record);
  }

  async listByUser(userId: string): Promise<PersonalAccessTokenEntity[]> {
    const records = await this.prisma.system.personalAccessToken.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toPersonalAccessTokenEntity);
  }

  async findByIdForUser(id: string, userId: string): Promise<PersonalAccessTokenEntity | null> {
    const record = await this.prisma.system.personalAccessToken.findFirst({
      where: { id, userId },
    });
    return record ? toPersonalAccessTokenEntity(record) : null;
  }

  /** Unscoped — used only by PersonalAccessTokenGuard, which authenticates
   * a request purely from the token itself, before any tenant context exists. */
  async findActiveByHash(tokenHash: string): Promise<PersonalAccessTokenEntity | null> {
    const record = await this.prisma.system.personalAccessToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return record ? toPersonalAccessTokenEntity(record) : null;
  }

  async touchLastUsedAt(id: string): Promise<void> {
    await this.prisma.system.personalAccessToken.updateMany({
      where: { id, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.system.personalAccessToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
