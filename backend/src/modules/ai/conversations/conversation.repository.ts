import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { ConversationEntity } from './entities/conversation.entity';
import { toConversationEntity, toJsonValue, toMessageEntity } from './entities/conversation.mapper';
import { MessageEntity } from './entities/message.entity';

export interface CreateConversationData {
  title: string;
  model: string;
  provider: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface UpdateConversationData {
  title?: string;
  model?: string;
  provider?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface FindAllConversationsParams {
  page: number;
  limit: number;
  search?: string;
  pinned?: boolean;
  archived?: boolean;
}

export interface PaginatedConversations {
  items: ConversationEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateMessageData {
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  tokenUsage?: Record<string, unknown>;
}

export interface FindConversationMessagesParams {
  page: number;
  limit: number;
}

export interface PaginatedMessages {
  items: MessageEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export type ConversationMessageRole = 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';

interface ConversationRecord {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  model: string;
  provider: string;
  pinned: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  role: ConversationMessageRole;
  content: string;
  metadata: Prisma.JsonValue;
  tokenUsage: Prisma.JsonValue;
  createdAt: Date;
}

interface ConversationClient {
  create(args: {
    data: {
      organizationId: string;
      userId: string;
      title: string;
      model: string;
      provider: string;
      pinned: boolean;
      archived: boolean;
    };
  }): Promise<ConversationRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<ConversationRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip: number;
    take: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<ConversationRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<ConversationRecord>;
}

interface MessageClient {
  create(args: {
    data: {
      conversationId: string;
      role: ConversationMessageRole;
      content: string;
      metadata: Prisma.InputJsonValue | Record<string, never>;
      tokenUsage: Prisma.InputJsonValue | Record<string, never>;
    };
  }): Promise<MessageRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: { createdAt: 'asc' | 'desc' };
  }): Promise<MessageRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

@Injectable()
export class ConversationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createConversation(data: CreateConversationData): Promise<ConversationEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.conversations().create({
      data: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        title: data.title,
        model: data.model,
        provider: data.provider,
        pinned: data.pinned ?? false,
        archived: data.archived ?? false,
      },
    });

    return toConversationEntity(record);
  }

  async findConversationById(id: string): Promise<ConversationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.conversations().findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
        deletedAt: null,
      },
    });

    return record ? toConversationEntity(record) : null;
  }

  async findAllConversations(params: FindAllConversationsParams): Promise<PaginatedConversations> {
    const { page, limit, search, pinned, archived } = params;
    const skip = (page - 1) * limit;
    const tenant = this.tenantContextService.getOrThrow();

    const where = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(pinned !== undefined ? { pinned } : {}),
      ...(archived !== undefined ? { archived } : {}),
      ...(search
        ? {
            OR: [
              { title: { contains: search, mode: 'insensitive' } },
              {
                messages: {
                  some: {
                    content: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : {}),
    };

    const [records, total] = await Promise.all([
      this.conversations().findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ pinned: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.conversations().count({ where }),
    ]);

    return {
      items: records.map(toConversationEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async updateConversation(
    id: string,
    data: UpdateConversationData,
  ): Promise<ConversationEntity | null> {
    const existing = await this.findConversationById(id);
    if (!existing) {
      return null;
    }

    const record = await this.conversations().update({
      where: { id },
      data: data as Record<string, unknown>,
    });

    return toConversationEntity(record);
  }

  async softDeleteConversation(id: string): Promise<ConversationEntity | null> {
    const existing = await this.findConversationById(id);
    if (!existing) {
      return null;
    }

    const record = await this.conversations().update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return toConversationEntity(record);
  }

  async createMessage(data: CreateMessageData): Promise<MessageEntity> {
    const record = await this.messages().create({
      data: {
        conversationId: data.conversationId,
        role: data.role,
        content: data.content,
        metadata: toJsonValue(data.metadata) ?? {},
        tokenUsage: toJsonValue(data.tokenUsage) ?? {},
      },
    });

    return toMessageEntity(record);
  }

  async findMessages(
    conversationId: string,
    params: FindConversationMessagesParams,
  ): Promise<PaginatedMessages> {
    const { page, limit } = params;
    const skip = (page - 1) * limit;
    const tenant = this.tenantContextService.getOrThrow();

    const where = {
      conversationId,
      conversation: {
        organizationId: tenant.organizationId,
        deletedAt: null,
      },
    };

    const [records, total] = await Promise.all([
      this.messages().findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.messages().count({ where }),
    ]);

    return {
      items: records.map(toMessageEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async findAllMessagesForConversation(conversationId: string): Promise<MessageEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.messages().findMany({
      where: {
        conversationId,
        conversation: {
          organizationId: tenant.organizationId,
          deletedAt: null,
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(toMessageEntity);
  }

  private conversations(): ConversationClient {
    return (this.prisma.system as unknown as { conversation: ConversationClient }).conversation;
  }

  private messages(): MessageClient {
    return (this.prisma.system as unknown as { message: MessageClient }).message;
  }
}
