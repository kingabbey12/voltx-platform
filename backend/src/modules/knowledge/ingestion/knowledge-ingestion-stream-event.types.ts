export type KnowledgeIngestionStreamEvent =
  | { type: 'indexing_started'; documentId: string; sourceId: string; title: string }
  | { type: 'text_extracted'; documentId: string; characterCount: number }
  | { type: 'chunking_completed'; documentId: string; chunkCount: number }
  | { type: 'embedding_started'; documentId: string; chunkCount: number }
  | { type: 'embedding_completed'; documentId: string; chunkCount: number; durationMs: number }
  | { type: 'indexing_completed'; documentId: string; chunkCount: number }
  | { type: 'indexing_failed'; documentId: string; error: string };

export interface KnowledgeIngestionResult {
  documentId: string;
  status: 'INDEXED' | 'FAILED';
  chunkCount: number;
  error?: string;
}
