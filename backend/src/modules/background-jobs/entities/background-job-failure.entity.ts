export interface BackgroundJobFailureEntity {
  id: string;
  organizationId: string | null;
  queueName: string;
  jobName: string;
  jobId: string | null;
  payload: Record<string, unknown>;
  failureReason: string;
  attemptsMade: number;
  createdAt: Date;
}
