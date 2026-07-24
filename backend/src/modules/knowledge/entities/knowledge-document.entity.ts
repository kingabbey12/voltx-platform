export type KnowledgeDocumentStatus = 'PENDING' | 'INDEXING' | 'INDEXED' | 'FAILED';

export interface KnowledgeDocumentEntity {
  id: string;
  organizationId: string;
  sourceId: string;
  collectionId: string | null;
  externalId: string | null;
  title: string;
  contentType: string;
  rawText: string | null;
  metadata: Record<string, unknown>;
  status: KnowledgeDocumentStatus;
  indexedAt: Date | null;
  error: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
