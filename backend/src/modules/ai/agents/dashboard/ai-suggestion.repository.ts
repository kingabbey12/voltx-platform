import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { AiSuggestionCategory, AiSuggestionEntity } from '../entities/ai-suggestion.entity';

export interface CreateAiSuggestionData {
  category: AiSuggestionCategory;
  title: string;
  description: string;
}

interface AiSuggestionClient {
  create(args: { data: Record<string, unknown> }): Promise<AiSuggestionRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<AiSuggestionRecord[]>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

interface AiSuggestionRecord {
  id: string;
  organizationId: string;
  category: AiSuggestionCategory;
  title: string;
  description: string;
  createdAt: Date;
  dismissedAt: Date | null;
}

@Injectable()
export class AiSuggestionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createMany(suggestions: CreateAiSuggestionData[]): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    for (const suggestion of suggestions) {
      await this.client().create({
        data: {
          organizationId: tenant.organizationId,
          category: suggestion.category,
          title: suggestion.title,
          description: suggestion.description,
        },
      });
    }
  }

  async listActive(): Promise<AiSuggestionEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { organizationId: tenant.organizationId, dismissedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toEntity);
  }

  async dismiss(id: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.client().updateMany({
      where: { id, organizationId: tenant.organizationId },
      data: { dismissedAt: new Date() },
    });
  }

  private client(): AiSuggestionClient {
    return (this.prisma.system as unknown as { aiSuggestion: AiSuggestionClient }).aiSuggestion;
  }
}

function toEntity(record: AiSuggestionRecord): AiSuggestionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    category: record.category,
    title: record.title,
    description: record.description,
    createdAt: record.createdAt,
    dismissedAt: record.dismissedAt,
  };
}
