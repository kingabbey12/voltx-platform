import { WorkflowStepType } from '../definition/workflow-definition.types';

export type WorkflowStepRunStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'WAITING_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'CANCELLED'
  | 'RETRYING';

export interface WorkflowStepRunEntity {
  id: string;
  organizationId: string;
  workflowRunId: string;
  stepId: string;
  type: WorkflowStepType;
  status: WorkflowStepRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  attempt: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}
