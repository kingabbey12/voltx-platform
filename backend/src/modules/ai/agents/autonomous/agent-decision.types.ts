export interface ToolCallDecision {
  kind: 'tool_call';
  thought: string;
  toolName: string;
  input: Record<string, unknown>;
}

export interface FinalAnswerDecision {
  kind: 'final_answer';
  thought: string;
  content: string;
}

export interface DelegationTarget {
  agentName: string;
  objective: string;
}

export interface DelegateDecision {
  kind: 'delegate';
  thought: string;
  agentName: string;
  objective: string;
}

export interface DelegateParallelDecision {
  kind: 'delegate_parallel';
  thought: string;
  delegations: DelegationTarget[];
}

export type AgentDecision =
  ToolCallDecision | FinalAnswerDecision | DelegateDecision | DelegateParallelDecision;
