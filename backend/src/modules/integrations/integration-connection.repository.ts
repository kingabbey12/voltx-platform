import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationAuthType, IntegrationProviderKey } from './provider/integration-provider.types';
import {
  IntegrationConnectionEntity,
  IntegrationConnectionStatus,
  IntegrationHealthStatus,
} from './entities/integration-connection.entity';

export interface CreateIntegrationConnectionData {
  provider: IntegrationProviderKey;
  displayName: string;
  authType: IntegrationAuthType;
  externalAccountId?: string;
  config?: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateIntegrationConnectionData {
  displayName?: string;
  status?: IntegrationConnectionStatus;
  externalAccountId?: string;
  config?: Record<string, unknown>;
  lastHealthCheckAt?: Date;
  lastHealthStatus?: IntegrationHealthStatus;
  lastSyncAt?: Date;
  lastError?: string | null;
  completedAt?: Date;
}

export interface FindIntegrationConnectionsParams {
  page: number;
  limit: number;
  provider?: IntegrationProviderKey;
  status?: IntegrationConnectionStatus;
}

export interface PaginatedIntegrationConnections {
  items: IntegrationConnectionEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface IntegrationConnectionRecord {
  id: string;
  organizationId: string;
  provider: IntegrationProviderKey;
  displayName: string;
  authType: IntegrationAuthType;
  status: IntegrationConnectionStatus;
  externalAccountId: string | null;
  config: Prisma.JsonValue;
  version: number;
  lastHealthCheckAt: Date | null;
  lastHealthStatus: IntegrationHealthStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface IntegrationConnectionClient {
  create(args: { data: Record<string, unknown> }): Promise<IntegrationConnectionRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<IntegrationConnectionRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<IntegrationConnectionRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<IntegrationConnectionRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

@Injectable()
export class IntegrationConnectionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateIntegrationConnectionData): Promise<IntegrationConnectionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        provider: data.provider,
        displayName: data.displayName,
        authType: data.authType,
        externalAccountId: data.externalAccountId,
        config: data.config ?? {},
        createdBy: data.createdBy,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<IntegrationConnectionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  /** Bypasses tenant scoping — only for background jobs (scheduler/poller) that must resolve a connection's organization before any tenant context exists. */
  async findByIdUnscoped(id: string): Promise<IntegrationConnectionEntity | null> {
    const record = await this.client().findFirst({ where: { id, deletedAt: null } });
    return record ? toEntity(record) : null;
  }

  /** Unscoped, cross-tenant — the background poller sweeps every connected, pollable connection across every organization on a fixed interval. */
  async listConnectedByProvidersUnscoped(
    providers: IntegrationProviderKey[],
  ): Promise<IntegrationConnectionEntity[]> {
    const records = await this.client().findMany({
      where: { status: 'CONNECTED', provider: { in: providers }, deletedAt: null },
    });
    return records.map(toEntity);
  }

  async findByProviderAndExternalAccountId(
    provider: IntegrationProviderKey,
    externalAccountId: string | undefined,
  ): Promise<IntegrationConnectionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: {
        organizationId: tenant.organizationId,
        provider,
        externalAccountId: externalAccountId ?? null,
        deletedAt: null,
      },
    });
    return record ? toEntity(record) : null;
  }

  async findAll(
    params: FindIntegrationConnectionsParams,
  ): Promise<PaginatedIntegrationConnections> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.provider ? { provider: params.provider } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.client().count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    };
  }

  async update(
    id: string,
    data: UpdateIntegrationConnectionData,
  ): Promise<IntegrationConnectionEntity> {
    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.externalAccountId !== undefined
          ? { externalAccountId: data.externalAccountId }
          : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.lastHealthCheckAt !== undefined
          ? { lastHealthCheckAt: data.lastHealthCheckAt }
          : {}),
        ...(data.lastHealthStatus !== undefined ? { lastHealthStatus: data.lastHealthStatus } : {}),
        ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
      },
    });
    return toEntity(record);
  }

  /** Optimistic concurrency — the "Connection Versioning" enterprise feature: concurrent admin edits to the same connection fail loudly instead of silently clobbering each other. */
  async updateWithVersion(
    id: string,
    expectedVersion: number,
    data: UpdateIntegrationConnectionData,
  ): Promise<IntegrationConnectionEntity> {
    const result = await this.client().updateMany({
      where: { id, version: expectedVersion },
      data: {
        ...(data.displayName !== undefined ? { displayName: data.displayName } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.externalAccountId !== undefined
          ? { externalAccountId: data.externalAccountId }
          : {}),
        ...(data.config !== undefined ? { config: data.config } : {}),
        ...(data.lastHealthCheckAt !== undefined
          ? { lastHealthCheckAt: data.lastHealthCheckAt }
          : {}),
        ...(data.lastHealthStatus !== undefined ? { lastHealthStatus: data.lastHealthStatus } : {}),
        ...(data.lastSyncAt !== undefined ? { lastSyncAt: data.lastSyncAt } : {}),
        ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
        version: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new ConflictException(
        `Integration connection "${id}" was modified concurrently — refresh and retry`,
      );
    }

    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    if (!record) {
      throw new ConflictException(`Integration connection "${id}" not found after update`);
    }
    return toEntity(record);
  }

  async softDelete(id: string): Promise<void> {
    await this.client().update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISCONNECTED' },
    });
  }

  private client(): IntegrationConnectionClient {
    return (this.prisma.system as unknown as { integrationConnection: IntegrationConnectionClient })
      .integrationConnection;
  }
}

function toEntity(record: IntegrationConnectionRecord): IntegrationConnectionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    provider: record.provider,
    displayName: record.displayName,
    authType: record.authType,
    status: record.status,
    externalAccountId: record.externalAccountId,
    config: toObject(record.config),
    version: record.version,
    lastHealthCheckAt: record.lastHealthCheckAt,
    lastHealthStatus: record.lastHealthStatus,
    lastSyncAt: record.lastSyncAt,
    lastError: record.lastError,
    createdBy: record.createdBy,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
