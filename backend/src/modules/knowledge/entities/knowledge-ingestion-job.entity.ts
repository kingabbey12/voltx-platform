export type KnowledgeJobType =
  'INGEST_DOCUMENT' | 'REINDEX_DOCUMENT' | 'REINDEX_SOURCE' | 'DELETE_DOCUMENT';

export type KnowledgeJobStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export type KnowledgeJobStage =
  'QUEUED' | 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'INDEXING' | 'DONE';

export interface KnowledgeIngestionJobEntity {
  id: string;
  organizationId: string;
  type: KnowledgeJobType;
  status: KnowledgeJobStatus;
  stage: KnowledgeJobStage;
  documentId: string | null;
  sourceId: string | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
  createdByMembershipId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface KnowledgeIngestionJobRecord {
  id: string;
  organizationId: string;
  type: KnowledgeJobType;
  status: KnowledgeJobStatus;
  stage: KnowledgeJobStage;
  documentId: string | null;
  sourceId: string | null;
  progress: number;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  metadata: unknown;
  createdByUserId: string | null;
  createdByMembershipId: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toKnowledgeIngestionJobEntity(
  record: KnowledgeIngestionJobRecord,
): KnowledgeIngestionJobEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    type: record.type,
    status: record.status,
    stage: record.stage,
    documentId: record.documentId,
    sourceId: record.sourceId,
    progress: record.progress,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    error: record.error,
    metadata:
      typeof record.metadata === 'object' &&
      record.metadata !== null &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {},
    createdByUserId: record.createdByUserId,
    createdByMembershipId: record.createdByMembershipId,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
