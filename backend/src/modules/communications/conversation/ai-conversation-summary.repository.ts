import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface CreateAIConversationSummaryData {
  conversationId: string;
  summary: string;
  sentiment?: string;
  urgency?: string;
  intent?: string;
}

export interface AIConversationSummaryRecord {
  id: string;
  organizationId: string;
  conversationId: string;
  version: number;
  summary: string;
  sentiment: string | null;
  urgency: string | null;
  intent: string | null;
  createdAt: Date;
}

interface AIConversationSummaryClient {
  create(args: { data: Record<string, unknown> }): Promise<AIConversationSummaryRecord>;
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<AIConversationSummaryRecord | null>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

@Injectable()
export class AIConversationSummaryRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    organizationId: string,
    data: CreateAIConversationSummaryData,
  ): Promise<AIConversationSummaryRecord> {
    const version = await this.client().count({
      where: { conversationId: data.conversationId, organizationId },
    });
    return this.client().create({
      data: {
        organizationId,
        conversationId: data.conversationId,
        version: version + 1,
        summary: data.summary,
        sentiment: data.sentiment,
        urgency: data.urgency,
        intent: data.intent,
      },
    });
  }

  async findLatest(conversationId: string): Promise<AIConversationSummaryRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({
      where: { conversationId, organizationId: tenant.organizationId },
      orderBy: { version: 'desc' },
    });
  }

  private client(): AIConversationSummaryClient {
    return (this.prisma.system as unknown as { aIConversationSummary: AIConversationSummaryClient })
      .aIConversationSummary;
  }
}
