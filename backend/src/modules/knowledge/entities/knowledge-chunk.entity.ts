export interface KnowledgeChunkEntity {
  id: string;
  organizationId: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  tokenCount: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  deletedAt: Date | null;
}

/** A chunk plus the document/source context needed to render a citation. */
export interface KnowledgeChunkWithContext extends KnowledgeChunkEntity {
  documentTitle: string;
  documentContentType: string;
  sourceId: string;
  sourceType: string;
  sourceName: string;
  externalId: string | null;
}

export interface SemanticSearchHit extends KnowledgeChunkWithContext {
  /** Cosine similarity in [0, 1] (1 - cosine_distance), higher is better. */
  similarity: number;
}

export interface KeywordSearchHit extends KnowledgeChunkWithContext {
  /** Postgres ts_rank score, unbounded, higher is better. */
  rank: number;
}
