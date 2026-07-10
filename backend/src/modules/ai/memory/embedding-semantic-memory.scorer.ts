import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { AIGatewayService } from '../gateway/ai-gateway.service';
import { MemoryEntity } from './entities/memory.entity';
import { MemoryRepository } from './memory.repository';
import { SemanticMemoryScorer } from './memory.scorer';

/**
 * Real semantic memory scoring, replacing NoopSemanticMemoryScorer —
 * cosine similarity between the query's embedding and each candidate
 * memory's stored embedding (computed once at capture time, see
 * MemoryService.captureConversationMemories). MemoryScorer.score() is
 * called once per candidate (up to 50 concurrently via Promise.all in
 * MemorySelector), all with the identical query string — queryEmbeddingCache
 * coalesces those into a single embeddings() call rather than one per
 * candidate, clearing its entry once resolved so it never grows unbounded.
 */
@Injectable()
export class EmbeddingSemanticMemoryScorer implements SemanticMemoryScorer {
  private readonly queryEmbeddingCache = new Map<string, Promise<number[] | null>>();

  constructor(
    @Inject(forwardRef(() => AIGatewayService))
    private readonly aiGatewayService: AIGatewayService,
    private readonly memoryRepository: MemoryRepository,
  ) {}

  async score(query: string, memory: MemoryEntity): Promise<number> {
    if (query.trim().length === 0) {
      return 0;
    }

    const [queryEmbedding, memoryEmbedding] = await Promise.all([
      this.getQueryEmbedding(query),
      this.memoryRepository.getEmbeddingForMemory(memory.id),
    ]);

    if (!queryEmbedding || !memoryEmbedding) {
      return 0;
    }

    return cosineSimilarity(queryEmbedding, memoryEmbedding);
  }

  private getQueryEmbedding(query: string): Promise<number[] | null> {
    const cached = this.queryEmbeddingCache.get(query);
    if (cached) {
      return cached;
    }

    const promise = this.aiGatewayService
      .embeddings({ input: [query] })
      .then((response) => response.vectors[0] ?? null)
      .catch(() => null)
      .finally(() => this.queryEmbeddingCache.delete(query));

    this.queryEmbeddingCache.set(query, promise);
    return promise;
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) {
    return 0;
  }

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] * a[index];
    normB += b[index] * b[index];
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  // Clamp to [0, 1] — MemoryScoreBreakdown treats every component as a
  // non-negative weight; a negative cosine similarity just means
  // "unrelated", scored the same as zero.
  return Math.max(0, dot / (Math.sqrt(normA) * Math.sqrt(normB)));
}
