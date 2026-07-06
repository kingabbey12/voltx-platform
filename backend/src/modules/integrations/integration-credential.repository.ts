import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';

export interface UpsertIntegrationCredentialData {
  connectionId: string;
  encryptedPayload: string;
  expiresAt?: Date | null;
}

export interface IntegrationCredentialRecord {
  id: string;
  connectionId: string;
  organizationId: string;
  encryptedPayload: string;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IntegrationCredentialClient {
  upsert(args: {
    where: { connectionId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<IntegrationCredentialRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<IntegrationCredentialRecord | null>;
  findMany(args: { where: Record<string, unknown> }): Promise<IntegrationCredentialRecord[]>;
  delete(args: { where: { connectionId: string } }): Promise<IntegrationCredentialRecord>;
}

/**
 * Kept as a separate table/repository from IntegrationConnection so that
 * listing/updating connection metadata never has to touch (or
 * accidentally serialize) encrypted secret material. Callers are
 * responsible for encrypting/decrypting via EncryptionService — this
 * repository only ever stores and returns opaque ciphertext.
 */
@Injectable()
export class IntegrationCredentialRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async upsert(data: UpsertIntegrationCredentialData): Promise<IntegrationCredentialRecord> {
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

  async findByConnectionId(connectionId: string): Promise<IntegrationCredentialRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({
      where: { connectionId, organizationId: tenant.organizationId },
    });
  }

  /** Bypasses tenant scoping — used only by the background token-refresh sweep, which runs before any tenant context exists for a given connection. */
  async findByConnectionIdUnscoped(
    connectionId: string,
  ): Promise<IntegrationCredentialRecord | null> {
    return this.client().findFirst({ where: { connectionId } });
  }

  /** Unscoped, cross-tenant — the refresh sweep needs to find every credential nearing expiry regardless of which org owns it. */
  async listExpiringBefore(before: Date): Promise<IntegrationCredentialRecord[]> {
    return this.client().findMany({ where: { expiresAt: { lte: before, not: null } } });
  }

  async delete(connectionId: string): Promise<void> {
    await this.client().delete({ where: { connectionId } });
  }

  private client(): IntegrationCredentialClient {
    return (this.prisma.system as unknown as { integrationCredential: IntegrationCredentialClient })
      .integrationCredential;
  }
}
