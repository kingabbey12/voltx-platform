import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AiUsageService } from '../../ai/gateway/ai-usage.service';
import { KnowledgeChunkRepository } from '../chunks/knowledge-chunk.repository';
import { KnowledgeDocumentRepository } from '../documents/knowledge-document.repository';
import { KnowledgeGraphService } from '../graph/knowledge-graph.service';
import { KnowledgeRetrievalService } from '../retrieval/knowledge-retrieval.service';
import { KnowledgeSourceRepository } from '../sources/knowledge-source.repository';
import { KnowledgeSearchLogRepository } from './knowledge-search-log.repository';

export interface KnowledgeStats {
  indexSize: {
    sourceCount: number;
    documentCount: number;
    indexedDocumentCount: number;
    pendingDocumentCount: number;
    failedDocumentCount: number;
    chunkCount: number;
    entityCount: number;
    relationshipCount: number;
  };
  embedding: {
    callCount: number;
    averageLatencyMs: number;
    totalCostUsd: number;
  };
  retrieval: {
    searchCount: number;
    averageLatencyMs: number;
    hitRate: number;
    cacheHitRate: number;
    averageConfidence: number;
  };
  cache: {
    hits: number;
    misses: number;
    writes: number;
    invalidations: number;
  };
}

const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Aggregates the admin statistics/health surface from data already
 * tracked elsewhere (AiUsageLog for embedding cost/latency,
 * KnowledgeSearchLog for retrieval quality, table counts for index size)
 * rather than a parallel metrics store.
 */
@Injectable()
export class KnowledgeStatsService {
  constructor(
    private readonly knowledgeSourceRepository: KnowledgeSourceRepository,
    private readonly knowledgeDocumentRepository: KnowledgeDocumentRepository,
    private readonly knowledgeChunkRepository: KnowledgeChunkRepository,
    private readonly knowledgeGraphService: KnowledgeGraphService,
    private readonly knowledgeRetrievalService: KnowledgeRetrievalService,
    private readonly knowledgeSearchLogRepository: KnowledgeSearchLogRepository,
    private readonly aiUsageService: AiUsageService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async getStats(windowMs: number = DEFAULT_WINDOW_MS): Promise<KnowledgeStats> {
    const tenant = this.tenantContextService.getOrThrow();

    const [
      sourceCount,
      documentCount,
      indexedDocumentCount,
      pendingDocumentCount,
      failedDocumentCount,
      chunkCount,
      graphStats,
      searchSummary,
      embeddingSummary,
      cacheMetrics,
    ] = await Promise.all([
      this.knowledgeSourceRepository.countForOrganization(),
      this.knowledgeDocumentRepository.countForOrganization(),
      this.knowledgeDocumentRepository.countByStatusForOrganization('INDEXED'),
      this.knowledgeDocumentRepository.countByStatusForOrganization('PENDING'),
      this.knowledgeDocumentRepository.countByStatusForOrganization('FAILED'),
      this.knowledgeChunkRepository.countForOrganization(),
      this.knowledgeGraphService.stats(),
      this.knowledgeSearchLogRepository.summarize(windowMs),
      this.aiUsageService.summarizeByRequestType(
        tenant.organizationId,
        'KNOWLEDGE_EMBEDDING',
        windowMs,
      ),
      this.knowledgeRetrievalService.getEmbeddingCacheMetrics(),
    ]);

    return {
      indexSize: {
        sourceCount,
        documentCount,
        indexedDocumentCount,
        pendingDocumentCount,
        failedDocumentCount,
        chunkCount,
        entityCount: graphStats.entityCount,
        relationshipCount: graphStats.relationshipCount,
      },
      embedding: {
        callCount: embeddingSummary.callCount,
        averageLatencyMs:
          embeddingSummary.callCount === 0
            ? 0
            : embeddingSummary.totalDurationMs / embeddingSummary.callCount,
        totalCostUsd: embeddingSummary.totalCostUsd,
      },
      retrieval: {
        searchCount: searchSummary.searchCount,
        averageLatencyMs: searchSummary.averageLatencyMs,
        hitRate: searchSummary.hitRate,
        cacheHitRate: searchSummary.cacheHitRate,
        averageConfidence: searchSummary.averageConfidence,
      },
      cache: cacheMetrics,
    };
  }

  /**
   * Health is a coarse boolean signal derived from the same stats: are
   * there any indexed documents, and is retrieval erroring/quiet enough to
   * flag. Kept simple and dependency-free (no external health-check
   * infrastructure) rather than introducing a new subsystem for it.
   */
  async getHealth(): Promise<{ healthy: boolean; reasons: string[] }> {
    const stats = await this.getStats();
    const reasons: string[] = [];

    if (stats.indexSize.chunkCount === 0) {
      reasons.push('No indexed knowledge chunks yet');
    }
    if (stats.retrieval.searchCount > 0 && stats.retrieval.hitRate < 0.2) {
      reasons.push('Retrieval hit rate is low over the last 24h');
    }

    return { healthy: reasons.length === 0, reasons };
  }
}
