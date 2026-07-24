export type AgentRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT' | 'WAITING_APPROVAL';

export type AgentRunTriggerType = 'MANUAL' | 'SCHEDULED' | 'EVENT';

export interface AgentRunEntity {
  id: string;
  agentId: string;
  conversationId: string;
  parentRunId: string | null;
  rootRunId: string | null;
  depth: number;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  currentStep: number;
  iterationCount: number;
  toolCallCount: number;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tokenUsage: Record<string, unknown>;
  error: string | null;
  agentVersionId: string | null;
  triggerType: AgentRunTriggerType;
  scheduleId: string | null;
  attemptNumber: number;
  createdAt: Date;
}
