export interface WorkflowRetryAttemptEntity {
  id: string;
  stepRunId: string;
  attemptNumber: number;
  error: string;
  delayMs: number;
  occurredAt: Date;
}

export type WorkflowLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface WorkflowExecutionLogEntity {
  id: string;
  workflowRunId: string;
  stepRunId: string | null;
  level: WorkflowLogLevel;
  event: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowCheckpointEntity {
  id: string;
  workflowRunId: string;
  stepId: string;
  state: Record<string, unknown>;
  createdAt: Date;
}

export type WorkflowApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export interface WorkflowApprovalEntity {
  id: string;
  organizationId: string;
  workflowRunId: string;
  stepRunId: string;
  status: WorkflowApprovalStatus;
  approverUserId: string | null;
  comment: string | null;
  expiresAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
}

export interface WorkflowDeadLetterEntity {
  id: string;
  organizationId: string;
  workflowRunId: string;
  stepId: string;
  reason: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowScheduleEntity {
  id: string;
  organizationId: string;
  workflowId: string;
  triggerType: 'CRON' | 'DELAYED' | 'EVENT';
  cronExpression: string | null;
  delayMs: number | null;
  eventName: string | null;
  input: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
