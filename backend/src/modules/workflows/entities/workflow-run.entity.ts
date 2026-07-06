export type WorkflowRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'PAUSED'
  | 'WAITING_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMED_OUT';

export type WorkflowTriggerType = 'MANUAL' | 'IMMEDIATE' | 'DELAYED' | 'CRON' | 'EVENT' | 'API';

export interface WorkflowRunEntity {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  conversationId: string;
  status: WorkflowRunStatus;
  triggerType: WorkflowTriggerType;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
  output: Record<string, unknown>;
  currentStepId: string | null;
  idempotencyKey: string | null;
  triggeredBy: string | null;
  error: string | null;
  version: number;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  queuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
