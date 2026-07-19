export type KnowledgeIngestionJobStatus =
  | 'QUEUED'
  | 'EXTRACTING'
  | 'CHUNKING'
  | 'EMBEDDING'
  | 'INDEXING'
  | 'READY'
  | 'FAILED'
  | 'CANCELLED';

export interface KnowledgeIngestionJobEntity {
  id: string;
  organizationId: string;
  sourceId: string;
  documentId: string | null;
  requestedByUserId: string;
  requestedByMembershipId: string;
  status: KnowledgeIngestionJobStatus;
  progressPercent: number;
  attemptsMade: number;
  maxAttempts: number;
  payload: Record<string, unknown>;
  resumeFromJobId: string | null;
  cancellationRequestedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}
