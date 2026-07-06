import { Injectable, Logger } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateKnowledgeSearchLogData {
  query: string;
  resultCount: number;
  citedResultCount: number;
  topConfidence: number | null;
  averageConfidence: number | null;
  latencyMs: number;
  cacheHit: boolean;
}

export interface KnowledgeSearchStatsSummary {
  searchCount: number;
  averageLatencyMs: number;
  cacheHitRate: number;
  averageConfidence: number;
  hitRate: number;
}

interface KnowledgeSearchLogClient {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  aggregate(args: Record<string, unknown>): Promise<{
    _count: { _all: number };
    _avg: { latencyMs: number | null; averageConfidence: number | null };
  }>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

/**
 * Never throws: recording a search log must never fail the search whose
 * outcome it's recording, matching AiUsageService's telemetry convention.
 */
@Injectable()
export class KnowledgeSearchLogRepository {
  private readonly logger = new Logger(KnowledgeSearchLogRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateKnowledgeSearchLogData): Promise<void> {
    try {
      const tenant = this.tenantContextService.getOrThrow();
      await this.client().create({
        data: {
          organizationId: tenant.organizationId,
          query: data.query,
          resultCount: data.resultCount,
          citedResultCount: data.citedResultCount,
          topConfidence: data.topConfidence,
          averageConfidence: data.averageConfidence,
          latencyMs: data.latencyMs,
          cacheHit: data.cacheHit,
        },
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to persist knowledge search log');
    }
  }

  async summarize(sinceMs: number): Promise<KnowledgeSearchStatsSummary> {
    const tenant = this.tenantContextService.getOrThrow();
    const since = new Date(Date.now() - sinceMs);
    const where = { organizationId: tenant.organizationId, createdAt: { gte: since } };

    const [aggregate, zeroResultCount, cacheHitCount] = await Promise.all([
      this.client().aggregate({
        where,
        _count: { _all: true },
        _avg: { latencyMs: true, averageConfidence: true },
      }),
      this.client().count({ where: { ...where, resultCount: 0 } }),
      this.client().count({ where: { ...where, cacheHit: true } }),
    ]);

    const searchCount = aggregate._count._all;

    return {
      searchCount,
      averageLatencyMs: aggregate._avg.latencyMs ?? 0,
      cacheHitRate: searchCount === 0 ? 0 : cacheHitCount / searchCount,
      averageConfidence: aggregate._avg.averageConfidence ?? 0,
      hitRate: searchCount === 0 ? 0 : (searchCount - zeroResultCount) / searchCount,
    };
  }

  private client(): KnowledgeSearchLogClient {
    return (this.prisma.system as unknown as { knowledgeSearchLog: KnowledgeSearchLogClient })
      .knowledgeSearchLog;
  }
}
