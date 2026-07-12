import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ApiKeyRecord {
  id: string;
  organizationId: string;
  createdByUserId: string | null;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopedPermissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateApiKeyData {
  organizationId: string;
  createdByUserId?: string;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopedPermissions: string[];
  expiresAt?: Date;
}

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateApiKeyData): Promise<ApiKeyRecord> {
    return this.prisma.apiKey.create({ data });
  }

  async listByOrganization(organizationId: string): Promise<ApiKeyRecord[]> {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdInOrganization(id: string, organizationId: string): Promise<ApiKeyRecord | null> {
    return this.prisma.apiKey.findFirst({ where: { id, organizationId } });
  }

  /** Unscoped — used only by ApiKeyGuard, which authenticates a request
   * purely from the key itself, before any tenant/org context exists. */
  async findActiveByHash(keyHash: string): Promise<ApiKeyRecord | null> {
    return this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
  }

  async touchLastUsedAt(id: string): Promise<void> {
    await this.prisma.apiKey.updateMany({
      where: { id, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
