import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { CommsChannel, CommsMessageStatus } from '../channels/channel-provider.interface';
import { CommsMessageDirection, CommsMessageEntity } from './entities/message.entity';

export interface CreateCommsMessageData {
  conversationId: string;
  direction: CommsMessageDirection;
  channel: CommsChannel;
  body: string;
  status?: CommsMessageStatus;
  senderId?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
  sentAt?: Date;
}

export interface UpdateCommsMessageData {
  status?: CommsMessageStatus;
  externalId?: string;
  deliveredAt?: Date;
  readAt?: Date;
  failedReason?: string | null;
}

interface CommsMessageRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  senderId: string | null;
  direction: CommsMessageDirection;
  channel: CommsChannel;
  status: CommsMessageStatus;
  body: string;
  externalId: string | null;
  metadata: Prisma.JsonValue;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
}

interface CommsMessageClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsMessageRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CommsMessageRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<CommsMessageRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<CommsMessageRecord>;
}

@Injectable()
export class MessageRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateCommsMessageData): Promise<CommsMessageEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.createUnscoped(tenant.organizationId, data);
  }

  /** Inbound webhook/poll ingestion runs outside a request's tenant context — the connection/conversation lookup already resolved the right org. */
  async createUnscoped(
    organizationId: string,
    data: CreateCommsMessageData,
  ): Promise<CommsMessageEntity> {
    const record = await this.client().create({
      data: {
        organizationId,
        conversationId: data.conversationId,
        direction: data.direction,
        channel: data.channel,
        status: data.status ?? 'QUEUED',
        body: data.body,
        senderId: data.senderId,
        externalId: data.externalId,
        metadata: data.metadata ?? {},
        sentAt: data.sentAt,
      },
    });
    return toEntity(record);
  }

  async findByExternalIdUnscoped(externalId: string): Promise<CommsMessageEntity | null> {
    const record = await this.client().findFirst({ where: { externalId } });
    return record ? toEntity(record) : null;
  }

  async findByConversation(
    conversationId: string,
    page: number,
    limit: number,
  ): Promise<{ items: CommsMessageEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { conversationId, organizationId: tenant.organizationId };
    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.client().count({ where }),
    ]);
    return { items: records.map(toEntity), total };
  }

  async update(id: string, data: UpdateCommsMessageData): Promise<CommsMessageEntity> {
    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
        ...(data.deliveredAt !== undefined ? { deliveredAt: data.deliveredAt } : {}),
        ...(data.readAt !== undefined ? { readAt: data.readAt } : {}),
        ...(data.failedReason !== undefined ? { failedReason: data.failedReason } : {}),
      },
    });
    return toEntity(record);
  }

  private client(): CommsMessageClient {
    return (this.prisma.system as unknown as { commsMessage: CommsMessageClient }).commsMessage;
  }
}

function toEntity(record: CommsMessageRecord): CommsMessageEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    conversationId: record.conversationId,
    senderId: record.senderId,
    direction: record.direction,
    channel: record.channel,
    status: record.status,
    body: record.body,
    externalId: record.externalId,
    metadata: toObject(record.metadata),
    sentAt: record.sentAt,
    deliveredAt: record.deliveredAt,
    readAt: record.readAt,
    failedReason: record.failedReason,
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
