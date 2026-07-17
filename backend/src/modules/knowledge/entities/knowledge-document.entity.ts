export type KnowledgeDocumentStatus = 'PENDING' | 'INDEXING' | 'INDEXED' | 'FAILED';

export interface KnowledgeDocumentEntity {
  id: string;
  organizationId: string;
  sourceId: string;
  externalId: string | null;
  title: string;
  contentType: string;
  rawText: string | null;
  metadata: Record<string, unknown>;
  status: KnowledgeDocumentStatus;
  indexedAt: Date | null;
  /** Non-null when the document was indexed without embeddings (no AI
   * provider available) — lexical search works, semantic search excludes
   * it until the backfill cron re-embeds and clears this. */
  embeddingsPendingAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
