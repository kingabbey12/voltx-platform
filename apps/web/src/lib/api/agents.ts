import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type AgentRunStatus =
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMED_OUT"
  | "WAITING_APPROVAL";

export interface AgentRun {
  id: string;
  agentId: string;
  conversationId: string;
  status: AgentRunStatus;
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

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface AgentApproval {
  id: string;
  agentRunId: string;
  toolName: string;
  input: Record<string, unknown>;
  status: ApprovalStatus;
  approverUserId: string | null;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
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

  listPendingApprovals: (query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<AgentApproval>>("/ai/approvals", {
      query: { page: 1, limit: 20, ...query },
    }),

  decideApproval: (approvalId: string, decision: "APPROVED" | "REJECTED", comment?: string) =>
    apiClient.post<AgentApproval>(`/ai/approvals/${approvalId}/decide`, { decision, comment }),
};
