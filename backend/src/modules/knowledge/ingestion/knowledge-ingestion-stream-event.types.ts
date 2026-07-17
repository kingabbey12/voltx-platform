export type KnowledgeIngestionStreamEvent =
  | { type: 'indexing_started'; documentId: string; sourceId: string; title: string }
  | { type: 'text_extracted'; documentId: string; characterCount: number }
  | { type: 'chunking_completed'; documentId: string; chunkCount: number }
  | { type: 'embedding_started'; documentId: string; chunkCount: number }
  | { type: 'embedding_completed'; documentId: string; chunkCount: number; durationMs: number }
  /** Emitted instead of embedding_completed when no AI provider is
   * available: chunks are stored without vectors (lexical search only)
   * and the document is flagged for the embedding backfill cron. */
  | { type: 'embedding_skipped'; documentId: string; chunkCount: number; reason: string }
  | { type: 'indexing_completed'; documentId: string; chunkCount: number }
  | { type: 'indexing_failed'; documentId: string; error: string };

export interface KnowledgeIngestionResult {
  documentId: string;
  status: 'INDEXED' | 'FAILED';
  chunkCount: number;
  /** True when the document was indexed without embeddings (no AI
   * provider available); semantic search excludes it until backfill. */
  embeddingsSkipped?: boolean;
  error?: string;
}
