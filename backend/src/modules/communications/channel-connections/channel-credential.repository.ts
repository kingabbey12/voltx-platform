import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';

export interface UpsertCommsCredentialData {
  connectionId: string;
  encryptedPayload: string;
  expiresAt?: Date | null;
}

export interface CommsChannelCredentialRecord {
  id: string;
  connectionId: string;
  organizationId: string;
  encryptedPayload: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface CommsChannelCredentialClient {
  upsert(args: {
    where: { connectionId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<CommsChannelCredentialRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CommsChannelCredentialRecord | null>;
  findMany(args: { where: Record<string, unknown> }): Promise<CommsChannelCredentialRecord[]>;
  delete(args: { where: { connectionId: string } }): Promise<CommsChannelCredentialRecord>;
}

/**
 * Mirrors IntegrationCredentialRepository exactly — separate table from
 * CommsChannelConnection so listing/updating connection metadata never
 * touches encrypted payloads. Callers encrypt/decrypt via EncryptionService;
 * this repository only stores opaque ciphertext.
 */
@Injectable()
export class CommsChannelCredentialRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async upsert(data: UpsertCommsCredentialData): Promise<CommsChannelCredentialRecord> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().upsert({
      where: { connectionId: data.connectionId },
      create: {
        connectionId: data.connectionId,
        organizationId: tenant.organizationId,
        encryptedPayload: data.encryptedPayload,
        expiresAt: data.expiresAt ?? null,
      },
      update: {
        encryptedPayload: data.encryptedPayload,
        expiresAt: data.expiresAt ?? null,
      },
    });
  }

  async findByConnectionId(connectionId: string): Promise<CommsChannelCredentialRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({
      where: { connectionId, organizationId: tenant.organizationId },
    });
  }

  /** Bypasses tenant scoping — used only by background jobs (polling, token refresh) that run outside a request's tenant context. */
  async findByConnectionIdUnscoped(
    connectionId: string,
  ): Promise<CommsChannelCredentialRecord | null> {
    return this.client().findFirst({ where: { connectionId } });
  }

  async listExpiringBefore(before: Date): Promise<CommsChannelCredentialRecord[]> {
    return this.client().findMany({ where: { expiresAt: { lte: before, not: null } } });
  }

  async delete(connectionId: string): Promise<void> {
    await this.client().delete({ where: { connectionId } });
  }

  private client(): CommsChannelCredentialClient {
    return (
      this.prisma.system as unknown as { commsChannelCredential: CommsChannelCredentialClient }
    ).commsChannelCredential;
  }
}
