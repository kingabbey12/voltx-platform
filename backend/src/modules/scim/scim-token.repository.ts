import { Injectable } from '@nestjs/common';
import { ScimTokenStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ScimTokenEntity, toScimTokenEntity } from './entities/scim-token.entity';

export interface CreateScimTokenData {
  organizationId: string;
  identityProviderId?: string;
  name: string;
  tokenHash: string;
  expiresAt?: Date;
}

@Injectable()
export class ScimTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateScimTokenData): Promise<ScimTokenEntity> {
    const record = await this.prisma.scimToken.create({
      data: {
        organizationId: data.organizationId,
        identityProviderId: data.identityProviderId,
        name: data.name,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
      },
    });
    return toScimTokenEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<ScimTokenEntity[]> {
    const records = await this.prisma.scimToken.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toScimTokenEntity);
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<ScimTokenEntity | null> {
    const record = await this.prisma.scimToken.findFirst({ where: { id, organizationId } });
    return record ? toScimTokenEntity(record) : null;
  }

  /** Unscoped — used by ScimTokenGuard, which authenticates purely by tokenHash before any tenant context exists. */
  async findActiveByTokenHash(tokenHash: string): Promise<ScimTokenEntity | null> {
    const record = await this.prisma.scimToken.findFirst({
      where: { tokenHash, status: ScimTokenStatus.ACTIVE },
    });
    return record ? toScimTokenEntity(record) : null;
  }

  async touchLastUsed(id: string): Promise<void> {
    await this.prisma.scimToken.update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.scimToken.update({
      where: { id },
      data: { status: ScimTokenStatus.REVOKED, revokedAt: new Date() },
    });
  }
}
