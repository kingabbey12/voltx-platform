import { Injectable } from '@nestjs/common';
import { KnowledgeSearchResult } from './knowledge-retrieval.types';
import { KnowledgeRerankerProvider, RerankRequest, RerankResponse } from './reranker.interface';

@Injectable()
export class DefaultRerankerProvider implements KnowledgeRerankerProvider {
  readonly name = 'default_hybrid_reranker';

  rerank(request: RerankRequest): Promise<RerankResponse> {
    const startedAt = Date.now();
    const normalizedQuery = request.query.trim().toLowerCase();
    const queryTerms = normalizedQuery.split(/\s+/).filter((term) => term.length > 0);

    const scored = request.candidates.map((candidate) => ({
      candidate,
      score: rerankScore(candidate, queryTerms),
    }));

    scored.sort((a, b) => b.score - a.score);

    const results = scored.slice(0, request.topK).map((item) => {
      const confidence = Math.min(1, Math.max(item.candidate.confidence, item.score));
      return {
        ...item.candidate,
        confidence,
        citation: {
          ...item.candidate.citation,
          confidence,
        },
      } satisfies KnowledgeSearchResult;
    });

    return Promise.resolve({
      results,
      latencyMs: Date.now() - startedAt,
      provider: this.name,
    });
  }
}

function rerankScore(candidate: KnowledgeSearchResult, queryTerms: string[]): number {
  const content = candidate.content.toLowerCase();
  const matches = queryTerms.reduce((sum, term) => sum + (content.includes(term) ? 1 : 0), 0);
  const lexicalMatch = queryTerms.length > 0 ? matches / queryTerms.length : 0;
  const semantic = candidate.semanticScore ?? 0;
  const keyword = candidate.keywordScore ?? 0;
  return Math.min(
    1,
    candidate.confidence * 0.55 + lexicalMatch * 0.3 + semantic * 0.1 + keyword * 0.05,
  );
}
