import { KnowledgeSearchFilters } from '../chunks/knowledge-chunk.repository';

export interface KnowledgeCitation {
  sourceId: string;
  sourceType: string;
  sourceName: string;
  documentId: string;
  documentTitle: string;
  externalId: string | null;
  chunkId: string;
  pageNumber: number | null;
  confidence: number;
  createdAt: string;
}

export interface KnowledgeSearchResult {
  chunkId: string;
  content: string;
  confidence: number;
  semanticScore: number | null;
  keywordScore: number | null;
  citation: KnowledgeCitation;
}

export interface KnowledgeSearchOptions {
  topK?: number;
  minConfidence?: number;
  filters?: KnowledgeSearchFilters;
  /** Trims/drops lowest-ranked results to fit this token budget. Omit to skip compression. */
  contextTokenBudget?: number;
}
