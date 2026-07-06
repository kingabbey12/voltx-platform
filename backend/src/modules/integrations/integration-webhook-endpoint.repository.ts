import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationProviderKey } from './provider/integration-provider.types';
import { IntegrationWebhookEndpointEntity } from './entities/integration-support.entity';

export interface CreateIntegrationWebhookEndpointData {
  connectionId: string;
  provider: IntegrationProviderKey;
  token: string;
  encryptedSecret: string;
}

interface IntegrationWebhookEndpointRecord {
  id: string;
  connectionId: string;
  organizationId: string;
  provider: IntegrationProviderKey;
  token: string;
  encryptedSecret: string;
  enabled: boolean;
  lastReceivedAt: Date | null;
  createdAt: Date;
}

interface IntegrationWebhookEndpointClient {
  create(args: { data: Record<string, unknown> }): Promise<IntegrationWebhookEndpointRecord>;
  findFirst(args: {
    where: Record<string, unknown>;
  }): Promise<IntegrationWebhookEndpointRecord | null>;
  findMany(args: { where: Record<string, unknown> }): Promise<IntegrationWebhookEndpointRecord[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<IntegrationWebhookEndpointRecord>;
}

@Injectable()
export class IntegrationWebhookEndpointRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    data: CreateIntegrationWebhookEndpointData,
  ): Promise<IntegrationWebhookEndpointEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        connectionId: data.connectionId,
        organizationId: tenant.organizationId,
        provider: data.provider,
        token: data.token,
        encryptedSecret: data.encryptedSecret,
      },
    });
    return toEntity(record);
  }

  /** Unscoped by design — an inbound webhook request arrives with no tenant context; the token itself (unguessable, unique) is what resolves it. */
  async findByTokenUnscoped(
    token: string,
  ): Promise<(IntegrationWebhookEndpointEntity & { encryptedSecret: string }) | null> {
    const record = await this.client().findFirst({ where: { token } });
    return record ? { ...toEntity(record), encryptedSecret: record.encryptedSecret } : null;
  }

  async listByConnection(connectionId: string): Promise<IntegrationWebhookEndpointEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { connectionId, organizationId: tenant.organizationId },
    });
    return records.map(toEntity);
  }

  async markReceived(id: string): Promise<void> {
    await this.client().update({ where: { id }, data: { lastReceivedAt: new Date() } });
  }

  async setEnabled(id: string, enabled: boolean): Promise<IntegrationWebhookEndpointEntity> {
    const record = await this.client().update({ where: { id }, data: { enabled } });
    return toEntity(record);
  }

  private client(): IntegrationWebhookEndpointClient {
    return (
      this.prisma.system as unknown as {
        integrationWebhookEndpoint: IntegrationWebhookEndpointClient;
      }
    ).integrationWebhookEndpoint;
  }
}

function toEntity(record: IntegrationWebhookEndpointRecord): IntegrationWebhookEndpointEntity {
  return {
    id: record.id,
    connectionId: record.connectionId,
    organizationId: record.organizationId,
    provider: record.provider,
    token: record.token,
    enabled: record.enabled,
    lastReceivedAt: record.lastReceivedAt,
    createdAt: record.createdAt,
  };
}
