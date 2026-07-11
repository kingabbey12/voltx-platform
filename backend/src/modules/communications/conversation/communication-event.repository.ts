import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export type CommsEventType =
  'DELIVERED' | 'READ' | 'TYPING' | 'REACTION_ADDED' | 'REACTION_REMOVED';

export interface CreateCommunicationEventData {
  conversationId: string;
  messageId?: string;
  type: CommsEventType;
  payload?: Record<string, unknown>;
  occurredAt?: Date;
}

export interface CommunicationEventRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  messageId: string | null;
  type: CommsEventType;
  payload: Record<string, unknown>;
  occurredAt: Date;
}

interface CommunicationEventClient {
  create(args: { data: Record<string, unknown> }): Promise<CommunicationEventRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<CommunicationEventRecord[]>;
}

/** Append-only fact log for delivered/read/typing/reaction events — see CommunicationEvent's schema doc comment. */
@Injectable()
export class CommunicationEventRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createUnscoped(
    organizationId: string,
    data: CreateCommunicationEventData,
  ): Promise<CommunicationEventRecord> {
    return this.client().create({
      data: {
        organizationId,
        conversationId: data.conversationId,
        messageId: data.messageId,
        type: data.type,
        payload: data.payload ?? {},
        occurredAt: data.occurredAt ?? new Date(),
      },
    });
  }

  async findByConversation(conversationId: string): Promise<CommunicationEventRecord[]> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findMany({
      where: { conversationId, organizationId: tenant.organizationId },
      orderBy: { occurredAt: 'asc' },
    });
  }

  private client(): CommunicationEventClient {
    return (this.prisma.system as unknown as { communicationEvent: CommunicationEventClient })
      .communicationEvent;
  }
}
