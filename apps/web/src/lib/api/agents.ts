import { apiClient } from "./client";

export interface AgentRun {
  id: string;
  agentId: string;
  conversationId: string;
  status: "RUNNING" | "SUCCEEDED" | "FAILED" | "TIMED_OUT";
  input: Record<string, unknown>;
  output: {
    outputText?: string;
    plan?: string[];
    toolResults?: { toolName: string; content: string; isError: boolean }[];
    [key: string]: unknown;
  };
  toolCallCount: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  error: string | null;
}

export interface RunAutonomousResult {
  run: AgentRun;
  assistantMessage: { content: string } | null;
}

export const agentsApi = {
  runAutonomous: (
    agentId: string,
    input: {
      conversationId: string;
      objective: string;
      workspaceContext?: string[];
      maxOutputTokens?: number;
    },
  ) => apiClient.post<RunAutonomousResult>(`/ai/agents/${agentId}/run/autonomous`, input),

  getRunTree: (runId: string) => apiClient.get<AgentRun[]>(`/ai/agents/runs/${runId}/tree`),
};
