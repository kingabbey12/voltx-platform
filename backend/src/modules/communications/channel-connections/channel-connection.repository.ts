import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { CommsChannel } from '../channels/channel-provider.interface';
import {
  CommsChannelConnectionEntity,
  CommsChannelConnectionStatus,
  CommsChannelHealthStatus,
} from './entities/channel-connection.entity';

export interface CreateCommsChannelConnectionData {
  channel: CommsChannel;
  displayName: string;
  externalAccountId?: string;
  config?: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateCommsChannelConnectionData {
  displayName?: string;
  status?: CommsChannelConnectionStatus;
  externalAccountId?: string;
  config?: Record<string, unknown>;
  lastHealthCheckAt?: Date;
  lastHealthStatus?: CommsChannelHealthStatus;
  lastSyncAt?: Date;
  lastError?: string | null;
}

export interface FindCommsChannelConnectionsParams {
  page: number;
  limit: number;
  channel?: CommsChannel;
  status?: CommsChannelConnectionStatus;
}

export interface PaginatedCommsChannelConnections {
  items: CommsChannelConnectionEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CommsChannelConnectionRecord {
  id: string;
  organizationId: string;
  channel: CommsChannel;
  displayName: string;
  status: CommsChannelConnectionStatus;
  externalAccountId: string | null;
  config: Prisma.JsonValue;
  lastHealthCheckAt: Date | null;
  lastHealthStatus: CommsChannelHealthStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface CommsChannelConnectionClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsChannelConnectionRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CommsChannelConnectionRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<CommsChannelConnectionRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<CommsChannelConnectionRecord>;
}

@Injectable()
export class ChannelConnectionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateCommsChannelConnectionData): Promise<CommsChannelConnectionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        channel: data.channel,
        displayName: data.displayName,
        externalAccountId: data.externalAccountId,
        config: data.config ?? {},
        createdBy: data.createdBy,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<CommsChannelConnectionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  /** Bypasses tenant scoping — used by background jobs (polling, webhooks) that resolve a connection before any tenant context exists. */
  async findByIdUnscoped(id: string): Promise<CommsChannelConnectionEntity | null> {
    const record = await this.client().findFirst({ where: { id, deletedAt: null } });
    return record ? toEntity(record) : null;
  }

  /**
   * Slack (and later WhatsApp/Teams) deliver every workspace/account's
   * events to one app-level webhook URL — the payload self-identifies via
   * team_id/phone_number_id, which is what's stored as externalAccountId.
   * This resolves which connection (and thus organization) an inbound
   * webhook belongs to, unscoped since webhooks arrive with no tenant
   * context.
   */
  async findByChannelAndExternalAccountIdUnscoped(
    channel: CommsChannel,
    externalAccountId: string,
  ): Promise<CommsChannelConnectionEntity | null> {
    const record = await this.client().findFirst({
      where: { channel, externalAccountId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  async findAll(
    params: FindCommsChannelConnectionsParams,
  ): Promise<PaginatedCommsChannelConnections> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.channel ? { channel: params.channel } : {}),
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
    data: UpdateCommsChannelConnectionData,
  ): Promise<CommsChannelConnectionEntity> {
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

  /** Cross-tenant, used only by the background poll sweep to find every connection worth polling regardless of which org owns it. */
  async listConnectedByChannelsUnscoped(
    channels: CommsChannel[],
  ): Promise<CommsChannelConnectionEntity[]> {
    const records = await this.client().findMany({
      where: { status: 'CONNECTED', channel: { in: channels }, deletedAt: null },
    });
    return records.map(toEntity);
  }

  async softDelete(id: string): Promise<CommsChannelConnectionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.findById(id);
    if (!existing) return null;
    const record = await this.client().update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISCONNECTED' },
    });
    void tenant;
    return toEntity(record);
  }

  private client(): CommsChannelConnectionClient {
    return (
      this.prisma.system as unknown as { commsChannelConnection: CommsChannelConnectionClient }
    ).commsChannelConnection;
  }
}

function toEntity(record: CommsChannelConnectionRecord): CommsChannelConnectionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    channel: record.channel,
    displayName: record.displayName,
    status: record.status,
    externalAccountId: record.externalAccountId,
    config: toObject(record.config),
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
