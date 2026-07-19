import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { KnowledgeSearchResult } from './knowledge-retrieval.types';
import { DefaultRerankerProvider } from './default-reranker.provider';

@Injectable()
export class KnowledgeRerankerService {
  private readonly defaultTopK: number;

  constructor(
    private readonly defaultProvider: DefaultRerankerProvider,
    configService: ConfigService,
  ) {
    this.defaultTopK = configService.get<number>('knowledge.reranker.topK', 8);
  }

  async rerank(
    query: string,
    candidates: KnowledgeSearchResult[],
    topK?: number,
  ): Promise<{ results: KnowledgeSearchResult[]; latencyMs: number; provider: string }> {
    return this.defaultProvider.rerank({
      query,
      candidates,
      topK: topK ?? this.defaultTopK,
    });
  }
}
