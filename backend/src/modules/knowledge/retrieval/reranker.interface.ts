import { KnowledgeSearchResult } from './knowledge-retrieval.types';

export interface RerankRequest {
  query: string;
  candidates: KnowledgeSearchResult[];
  topK: number;
}

export interface RerankResponse {
  results: KnowledgeSearchResult[];
  latencyMs: number;
  provider: string;
}

export interface KnowledgeRerankerProvider {
  readonly name: string;
  rerank(request: RerankRequest): Promise<RerankResponse>;
}
