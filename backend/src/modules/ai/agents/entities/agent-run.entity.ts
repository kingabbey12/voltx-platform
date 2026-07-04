export type AgentRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';

export interface AgentRunEntity {
  id: string;
  agentId: string;
  conversationId: string;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tokenUsage: Record<string, unknown>;
  error: string | null;
  createdAt: Date;
}
