import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { CommsChannel } from '../channels/channel-provider.interface';
import {
  CommsConversationEntity,
  CommsConversationPriority,
  CommsConversationStatus,
} from './entities/conversation.entity';

export interface CreateCommsConversationData {
  connectionId: string;
  channel: CommsChannel;
  contactId?: string;
  subject?: string;
  externalThreadId?: string;
}

export interface UpdateCommsConversationData {
  contactId?: string | null;
  assigneeId?: string | null;
  status?: CommsConversationStatus;
  priority?: CommsConversationPriority;
  unread?: boolean;
  subject?: string;
  lastMessageAt?: Date;
}

export interface FindCommsConversationsParams {
  page: number;
  limit: number;
  search?: string;
  status?: CommsConversationStatus;
  unread?: boolean;
  assigneeId?: string;
  priority?: CommsConversationPriority;
  channel?: CommsChannel;
}

export interface PaginatedCommsConversations {
  items: CommsConversationEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CommsConversationRecord {
  id: string;
  organizationId: string;
  connectionId: string;
  contactId: string | null;
  assigneeId: string | null;
  channel: CommsChannel;
  subject: string | null;
  status: CommsConversationStatus;
  priority: CommsConversationPriority;
  unread: boolean;
  externalThreadId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface CommsConversationClient {
  create(args: { data: Record<string, unknown> }): Promise<CommsConversationRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<CommsConversationRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<CommsConversationRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<CommsConversationRecord>;
}

@Injectable()
export class ConversationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateCommsConversationData): Promise<CommsConversationEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        connectionId: data.connectionId,
        channel: data.channel,
        contactId: data.contactId,
        subject: data.subject,
        externalThreadId: data.externalThreadId,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<CommsConversationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  /** Unscoped — used by the background AI post-processing job, which resolves tenant context from the conversation itself rather than the other way around. */
  async findByIdUnscoped(id: string): Promise<CommsConversationEntity | null> {
    const record = await this.client().findFirst({ where: { id, deletedAt: null } });
    return record ? toEntity(record) : null;
  }

  /** Used to correlate an inbound message with an existing thread — unscoped since inbound webhooks/polling run outside a request's tenant context; the connectionId itself is already org-resolved by the caller. */
  async findByConnectionAndExternalThreadUnscoped(
    connectionId: string,
    externalThreadId: string,
  ): Promise<CommsConversationEntity | null> {
    const record = await this.client().findFirst({
      where: { connectionId, externalThreadId, deletedAt: null },
    });
    return record ? toEntity(record) : null;
  }

  async createUnscoped(
    organizationId: string,
    data: CreateCommsConversationData,
  ): Promise<CommsConversationEntity> {
    const record = await this.client().create({
      data: {
        organizationId,
        connectionId: data.connectionId,
        channel: data.channel,
        contactId: data.contactId,
        subject: data.subject,
        externalThreadId: data.externalThreadId,
      },
    });
    return toEntity(record);
  }

  async findAll(params: FindCommsConversationsParams): Promise<PaginatedCommsConversations> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.unread !== undefined ? { unread: params.unread } : {}),
      ...(params.assigneeId ? { assigneeId: params.assigneeId } : {}),
      ...(params.priority ? { priority: params.priority } : {}),
      ...(params.channel ? { channel: params.channel } : {}),
      ...(params.search ? { subject: { contains: params.search, mode: 'insensitive' } } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        orderBy: { lastMessageAt: 'desc' },
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

  async update(id: string, data: UpdateCommsConversationData): Promise<CommsConversationEntity> {
    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.contactId !== undefined ? { contactId: data.contactId } : {}),
        ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.unread !== undefined ? { unread: data.unread } : {}),
        ...(data.subject !== undefined ? { subject: data.subject } : {}),
        ...(data.lastMessageAt !== undefined ? { lastMessageAt: data.lastMessageAt } : {}),
      },
    });
    return toEntity(record);
  }

  async softDelete(id: string): Promise<void> {
    await this.client().update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private client(): CommsConversationClient {
    return (this.prisma.system as unknown as { commsConversation: CommsConversationClient })
      .commsConversation;
  }
}

function toEntity(record: CommsConversationRecord): CommsConversationEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    connectionId: record.connectionId,
    contactId: record.contactId,
    assigneeId: record.assigneeId,
    channel: record.channel,
    subject: record.subject,
    status: record.status,
    priority: record.priority,
    unread: record.unread,
    externalThreadId: record.externalThreadId,
    lastMessageAt: record.lastMessageAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}
