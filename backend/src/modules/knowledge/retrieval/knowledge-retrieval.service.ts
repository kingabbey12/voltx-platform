import {
  forwardRef,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIProviderName } from '../../ai/models/ai-model.types';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { estimateTokenCount } from '../chunking/text-chunker.service';
import { KnowledgeChunkRepository } from '../chunks/knowledge-chunk.repository';
import { SemanticSearchHit, KeywordSearchHit } from '../entities/knowledge-chunk.entity';
import { KnowledgeSearchLogRepository } from '../observability/knowledge-search-log.repository';
import { EMBEDDING_CACHE, EmbeddingCache } from './embedding-cache';
import { KnowledgeRerankerService } from './knowledge-reranker.service';
import { KnowledgeSearchOptions, KnowledgeSearchResult } from './knowledge-retrieval.types';

const RRF_K = 60;
const CITATION_QUALITY_THRESHOLD = 0.5;
const KEYWORD_RANK_SMOOTHING = 0.1;

/**
 * Hybrid retrieval over knowledge chunks: runs semantic (pgvector cosine)
 * and keyword (Postgres full-text) search concurrently, fuses them with
 * weighted Reciprocal Rank Fusion (rank-based, so it never has to
 * reconcile cosine-similarity and ts_rank being on different scales),
 * dedupes, scores confidence, compresses to a token budget, and attaches
 * citation metadata to every result. This is the single retrieval
 * interface every source type and every consumer (Gateway auto-injection,
 * agent context builder, admin search/preview) goes through.
 */
@Injectable()
export class KnowledgeRetrievalService {
  private readonly logger = new Logger(KnowledgeRetrievalService.name);
  private readonly embeddingProvider: AIProviderName;
  private readonly embeddingModel: string;
  private readonly defaultTopK: number;
  private readonly maxTopK: number;
  private readonly semanticWeight: number;
  private readonly keywordWeight: number;
  private readonly minConfidence: number;
  private readonly contextTokenBudget: number;
  private readonly cacheTtlMs: number;
  private readonly rerankerTopK: number;

  constructor(
    private readonly knowledgeChunkRepository: KnowledgeChunkRepository,
    @Inject(forwardRef(() => AIGatewayService))
    private readonly aiGatewayService: AIGatewayService,
    private readonly knowledgeSearchLogRepository: KnowledgeSearchLogRepository,
    @Inject(EMBEDDING_CACHE)
    private readonly embeddingCache: EmbeddingCache,
    private readonly knowledgeRerankerService: KnowledgeRerankerService,
    configService: ConfigService,
  ) {
    this.embeddingProvider = configService.get<AIProviderName>(
      'knowledge.embeddingProvider',
      'openai',
    );
    this.embeddingModel = configService.get<string>(
      'knowledge.embeddingModel',
      'text-embedding-3-small',
    );
    this.defaultTopK = configService.get<number>('knowledge.retrieval.defaultTopK', 8);
    this.maxTopK = configService.get<number>('knowledge.retrieval.maxTopK', 50);
    this.semanticWeight = configService.get<number>('knowledge.retrieval.semanticWeight', 0.65);
    this.keywordWeight = configService.get<number>('knowledge.retrieval.keywordWeight', 0.35);
    this.minConfidence = configService.get<number>('knowledge.retrieval.minConfidence', 0.15);
    this.contextTokenBudget = configService.get<number>(
      'knowledge.retrieval.contextTokenBudget',
      2000,
    );
    this.cacheTtlMs = configService.get<number>('knowledge.retrieval.cacheTtlMs', 30000);
    this.rerankerTopK = configService.get<number>('knowledge.reranker.topK', 8);
  }

  async search(
    query: string,
    options: KnowledgeSearchOptions = {},
    signal?: AbortSignal,
  ): Promise<KnowledgeSearchResult[]> {
    const startedAt = Date.now();
    const normalizedQuery = query.trim();
    if (normalizedQuery.length === 0) {
      return [];
    }

    const topK = Math.min(options.topK ?? this.defaultTopK, this.maxTopK);
    const minConfidence = options.minConfidence ?? this.minConfidence;

    const { vector: queryEmbedding, cacheHit } = await this.safeResolveQueryEmbedding(
      normalizedQuery,
      signal,
    );

    const [semanticHits, keywordHits] = await Promise.all([
      queryEmbedding
        ? this.knowledgeChunkRepository.semanticSearch(queryEmbedding, topK * 3, options.filters)
        : Promise.resolve([]),
      this.safeKeywordSearch(normalizedQuery, topK * 3, options.filters),
    ]);

    const fused = this.fuse(semanticHits, keywordHits);
    const deduped = dedupeByContent(fused);
    const filtered = deduped.filter((result) => result.confidence >= minConfidence);
    filtered.sort((a, b) => b.confidence - a.confidence);
    const preRerank = filtered.slice(0, Math.max(topK, this.rerankerTopK));
    const rerank = await this.knowledgeRerankerService.rerank(
      normalizedQuery,
      preRerank,
      Math.max(topK, this.rerankerTopK),
    );
    const top = rerank.results.slice(0, topK);
    const compressed = this.compress(top, options.contextTokenBudget ?? this.contextTokenBudget);

    void this.logSearch(
      normalizedQuery,
      compressed,
      Date.now() - startedAt,
      cacheHit,
      rerank.latencyMs,
    );

    return compressed;
  }

  async invalidateEmbeddingCache(): Promise<void> {
    await this.embeddingCache.invalidateAll();
  }

  async getEmbeddingCacheMetrics(): Promise<{
    hits: number;
    misses: number;
    writes: number;
    invalidations: number;
  }> {
    return this.embeddingCache.getMetrics();
  }

  /**
   * Query embedding with the same degradation contract as the keyword
   * leg: if no AI provider is available (ServiceUnavailableException),
   * search continues keyword-only instead of failing outright — the
   * mirror image of safeKeywordSearch, and the query-time counterpart of
   * ingestion's embedding_skipped path.
   */
  private async safeResolveQueryEmbedding(
    query: string,
    signal?: AbortSignal,
  ): Promise<{ vector: number[] | null; cacheHit: boolean }> {
    try {
      return await this.resolveQueryEmbedding(query, signal);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        this.logger.warn(
          { reason: error.message },
          'Query embedding unavailable — continuing with keyword-only search',
        );
        return { vector: null, cacheHit: false };
      }
      throw error;
    }
  }

  private async resolveQueryEmbedding(
    query: string,
    signal?: AbortSignal,
  ): Promise<{ vector: number[]; cacheHit: boolean }> {
    const cacheKey = `${this.embeddingModel}:${query}`;
    const cached = await this.embeddingCache.get(cacheKey);
    if (cached) {
      return { vector: cached, cacheHit: true };
    }

    const response = await this.aiGatewayService.embeddings({
      provider: this.embeddingProvider,
      model: this.embeddingModel,
      input: [query],
      signal,
    });

    const vector = response.vectors[0] ?? [];
    await this.embeddingCache.set(cacheKey, vector, this.cacheTtlMs);

    return { vector, cacheHit: false };
  }

  private async safeKeywordSearch(
    query: string,
    limit: number,
    filters?: KnowledgeSearchOptions['filters'],
  ): Promise<KeywordSearchHit[]> {
    try {
      return await this.knowledgeChunkRepository.keywordSearch(query, limit, filters);
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Keyword search failed; continuing with semantic-only results',
      );
      return [];
    }
  }

  private fuse(
    semanticHits: SemanticSearchHit[],
    keywordHits: KeywordSearchHit[],
  ): KnowledgeSearchResult[] {
    const maxPossibleScore = this.semanticWeight * rrf(1) + this.keywordWeight * rrf(1);
    const byChunkId = new Map<
      string,
      {
        hit: SemanticSearchHit | KeywordSearchHit;
        semanticScore: number | null;
        keywordScore: number | null;
        fused: number;
      }
    >();

    semanticHits.forEach((hit, index) => {
      const normalizedSimilarity = Math.min(1, Math.max(0, hit.similarity));
      byChunkId.set(hit.id, {
        hit,
        semanticScore: hit.similarity,
        keywordScore: null,
        fused: this.semanticWeight * rrf(index + 1) * normalizedSimilarity,
      });
    });

    keywordHits.forEach((hit, index) => {
      // ts_rank is unbounded but typically well under 1 even for strong
      // matches (it's a term-frequency/proximity score, not a similarity
      // score) — a small smoothing constant keeps realistic matches from
      // being crushed toward zero the way rank/(rank+1) would.
      const normalizedRank = hit.rank / (hit.rank + KEYWORD_RANK_SMOOTHING);
      const existing = byChunkId.get(hit.id);
      const contribution = this.keywordWeight * rrf(index + 1) * normalizedRank;
      if (existing) {
        existing.keywordScore = hit.rank;
        existing.fused += contribution;
      } else {
        byChunkId.set(hit.id, {
          hit,
          semanticScore: null,
          keywordScore: hit.rank,
          fused: contribution,
        });
      }
    });

    return Array.from(byChunkId.values()).map(({ hit, semanticScore, keywordScore, fused }) => ({
      chunkId: hit.id,
      content: hit.content,
      confidence: Math.min(1, Math.max(0, fused / maxPossibleScore)),
      semanticScore,
      keywordScore,
      citation: {
        sourceId: hit.sourceId,
        sourceType: hit.sourceType,
        sourceName: hit.sourceName,
        documentId: hit.documentId,
        documentTitle: hit.documentTitle,
        externalId: hit.externalId,
        chunkId: hit.id,
        pageNumber: toPageNumber(hit.metadata),
        confidence: Math.min(1, Math.max(0, fused / maxPossibleScore)),
        createdAt: hit.createdAt.toISOString(),
      },
    }));
  }

  private compress(results: KnowledgeSearchResult[], tokenBudget: number): KnowledgeSearchResult[] {
    const compressed: KnowledgeSearchResult[] = [];
    let usedTokens = 0;

    for (const result of results) {
      const tokens = estimateTokenCount(result.content);
      if (usedTokens >= tokenBudget) {
        break;
      }

      if (usedTokens + tokens <= tokenBudget) {
        compressed.push(result);
        usedTokens += tokens;
        continue;
      }

      const remainingTokens = tokenBudget - usedTokens;
      const truncated = truncateToApproxTokens(result.content, remainingTokens);
      if (truncated.length > 0) {
        compressed.push({ ...result, content: truncated });
      }
      break;
    }

    return compressed;
  }

  /**
   * Fire-and-forget from search(): never awaited by the caller, so a
   * rejection here must be caught locally rather than relying solely on
   * the repository's own "never throws" guarantee — an uncaught rejection
   * in a detached (`void`-called) async function becomes an unhandled
   * promise rejection, matching why AIGatewayService wraps its own
   * fire-and-forget telemetry in safelyRecordTelemetry.
   */
  private async logSearch(
    query: string,
    results: KnowledgeSearchResult[],
    latencyMs: number,
    cacheHit: boolean,
    rerankLatencyMs: number,
  ): Promise<void> {
    try {
      const confidences = results.map((result) => result.confidence);
      const citedResultCount = confidences.filter(
        (confidence) => confidence >= CITATION_QUALITY_THRESHOLD,
      ).length;

      await this.knowledgeSearchLogRepository.create({
        query,
        resultCount: results.length,
        citedResultCount,
        topConfidence: confidences.length > 0 ? Math.max(...confidences) : null,
        averageConfidence:
          confidences.length > 0
            ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length
            : null,
        latencyMs,
        rerankLatencyMs,
        cacheHit,
      });
    } catch (error) {
      this.logger.error({ err: error }, 'Failed to log knowledge search');
    }
  }
}

function toPageNumber(metadata: Record<string, unknown>): number | null {
  const candidate = metadata.pageNumber;
  if (typeof candidate === 'number' && Number.isFinite(candidate)) {
    return Math.floor(candidate);
  }
  if (typeof candidate === 'string' && candidate.trim().length > 0) {
    const parsed = Number.parseInt(candidate, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function rrf(rank: number): number {
  return 1 / (RRF_K + rank);
}

function dedupeByContent(results: KnowledgeSearchResult[]): KnowledgeSearchResult[] {
  const seen = new Set<string>();
  const deduped: KnowledgeSearchResult[] = [];

  for (const result of results) {
    const normalized = result.content.trim().toLowerCase().replace(/\s+/g, ' ');
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(result);
  }

  return deduped;
}

function truncateToApproxTokens(text: string, tokenBudget: number): string {
  if (tokenBudget <= 0) {
    return '';
  }

  const words = text.split(/\s+/).filter(Boolean);
  const approxWordBudget = Math.max(1, Math.round(tokenBudget / 1.3));
  return words.slice(0, approxWordBudget).join(' ');
}
