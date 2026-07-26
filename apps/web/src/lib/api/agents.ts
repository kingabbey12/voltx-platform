import { apiClient } from "./client";
import { tokenStorage } from "./token-storage";
import { API_BASE_URL } from "@/config/env";
import type { PaginatedResult } from "./types";

// ─── Provider ───────────────────────────────────────────────────────

export type AIProviderName =
  | "anthropic"
  | "google"
  | "openai"
  | "xai"
  | "groq"
  | "mistral"
  | "deepseek"
  | "ollama"
  | "openrouter"
  | "azure-openai";

// ─── Agent ──────────────────────────────────────────────────────────

export interface AgentConfiguration {
  kind?: "system" | "custom";
  systemAgentKey?: string;
  toolNames?: string[];
  temperature?: number;
  maxOutputTokens?: number;
  canDelegate?: boolean;
  delegateToAgentNames?: string[];
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: AIProviderName;
  model: string;
  configuration: AgentConfiguration & Record<string, unknown>;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentInput {
  name: string;
  description: string;
  systemPrompt: string;
  provider?: AIProviderName;
  model?: string;
  configuration?: Partial<AgentConfiguration>;
  enabled?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  systemPrompt?: string;
  provider?: AIProviderName;
  model?: string;
  configuration?: Partial<AgentConfiguration>;
  enabled?: boolean;
}

// ─── Agent Run ──────────────────────────────────────────────────────

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
  parentRunId: string | null;
  rootRunId: string | null;
  depth: number;
  status: AgentRunStatus;
  input: Record<string, unknown>;
  output: {
    outputText?: string;
    plan?: string[];
    toolResults?: { toolName: string; content: string; isError: boolean }[];
    [key: string]: unknown;
  };
  currentStep: number;
  iterationCount: number;
  toolCallCount: number;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  tokenUsage: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
    [key: string]: unknown;
  };
  error: string | null;
  createdAt: string;
}

export interface RunAgentInput {
  conversationId: string;
  prompt: string;
  workspaceContext?: string[];
  toolRequests?: {
    toolName: string;
    input: Record<string, unknown>;
    timeoutMs?: number;
    retries?: number;
  }[];
  temperature?: number;
  maxOutputTokens?: number;
}

export interface RunAutonomousInput {
  conversationId: string;
  objective: string;
  workspaceContext?: string[];
  temperature?: number;
  maxOutputTokens?: number;
  maxIterations?: number;
  maxToolCalls?: number;
  timeoutMs?: number;
}

export interface RunAgentResult {
  run: AgentRun;
  userMessage: { id: string; content: string };
  toolMessages: { id: string; content: string }[];
  assistantMessage: { id: string; content: string } | null;
}

export interface RunAutonomousResult {
  run: AgentRun;
  assistantMessage: { content: string } | null;
}

// ─── Agent Stats ────────────────────────────────────────────────────

export interface AgentStats {
  agentId: string;
  toolCount: number;
  totalRunCount: number;
  succeededRunCount: number;
  lastRunAt: string | null;
}

// ─── SSE Events ─────────────────────────────────────────────────────

export type AgentStreamStage = "planning" | "executing_tool" | "finalizing";

export interface AgentStreamStatusEvent {
  type: "status";
  status: "queued" | "processing" | "streaming" | "completed" | "cancelled" | "failed";
}

export interface AgentStreamReasoningEvent {
  type: "reasoning";
  stage: AgentStreamStage;
  message: string;
}

export interface AgentStreamToolCallStartEvent {
  type: "tool_call_start";
  toolName: string;
}

export interface AgentStreamToolCallResultEvent {
  type: "tool_call_result";
  toolName: string;
  durationMs: number;
}

export interface AgentStreamToolCallErrorEvent {
  type: "tool_call_error";
  toolName: string;
  message: string;
}

export interface AgentStreamProviderEvent {
  type: "provider_event";
  event: unknown;
}

export type AgentStreamEvent =
  | AgentStreamStatusEvent
  | AgentStreamReasoningEvent
  | AgentStreamToolCallStartEvent
  | AgentStreamToolCallResultEvent
  | AgentStreamToolCallErrorEvent
  | AgentStreamProviderEvent;

// ─── Multi-agent events (autonomous only) ───────────────────────────

export interface MultiAgentCoordinatorStarted {
  type: "coordinator_started";
  rootRunId: string;
  objective: string;
}

export interface MultiAgentSpawned {
  type: "agent_spawned";
  agentRunId: string;
  agentName: string;
  parentRunId: string;
  depth: number;
}

export interface MultiAgentWorking {
  type: "agent_working";
  agentRunId: string;
  agentName: string;
}

export interface MultiAgentWaiting {
  type: "agent_waiting";
  agentRunId: string;
  agentName: string;
  waitingOnAgentRunId: string;
}

export interface MultiAgentCompleted {
  type: "agent_completed";
  agentRunId: string;
  agentName: string;
  succeeded: boolean;
}

export interface MultiAgentDelegation {
  type: "delegation";
  fromAgentRunId: string;
  toAgentName: string;
  objective: string;
}

export interface MultiAgentAggregation {
  type: "aggregation";
  agentRunId: string;
  childAgentRunIds: string[];
}

export interface MultiAgentCoordinatorFinished {
  type: "coordinator_finished";
  rootRunId: string;
  outputText: string;
}

export interface MultiAgentAgentEvent {
  type: "agent_event";
  agentRunId: string;
  agentName: string;
  parentRunId: string | null;
  depth: number;
  event: AgentStreamEvent | MultiAgentStreamEvent;
}

export type MultiAgentStreamEvent =
  | MultiAgentCoordinatorStarted
  | MultiAgentSpawned
  | MultiAgentWorking
  | MultiAgentWaiting
  | MultiAgentCompleted
  | MultiAgentDelegation
  | MultiAgentAggregation
  | MultiAgentCoordinatorFinished
  | MultiAgentAgentEvent;

export type AgentAllStreamEvent = AgentStreamEvent | MultiAgentStreamEvent;

// ─── Approval ───────────────────────────────────────────────────────

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";

export interface AgentApproval {
  id: string;
  agentRunId: string;
  toolName: string;
  input: Record<string, unknown>;
  summary: string | null;
  status: ApprovalStatus;
  approverUserId: string | null;
  comment: string | null;
  decidedAt: string | null;
  createdAt: string;
}

// ─── SSE parser ─────────────────────────────────────────────────────

function parseSSELine(line: string): { event?: string; data?: string } | null {
  if (line.startsWith("event:")) return { event: line.slice(6).trim() };
  if (line.startsWith("data:")) return { data: line.slice(5).trim() };
  return null;
}

async function* readSSEStream(
  response: Response,
): AsyncGenerator<AgentAllStreamEvent> {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    let currentData = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (line.trim() === "") {
          if (currentData) {
            try {
              const parsed = JSON.parse(currentData) as AgentAllStreamEvent;
              yield parsed;
            } catch { /* skip malformed JSON */ }
          }
          currentData = "";
          continue;
        }
        const parsed = parseSSELine(line);
        if (parsed?.data) currentData = parsed.data;
      }
    }

    if (currentData) {
      try {
        const parsed = JSON.parse(currentData) as AgentAllStreamEvent;
        yield parsed;
      } catch { /* skip */ }
    }
}

// ─── API ────────────────────────────────────────────────────────────

export const agentsApi = {
  // ── CRUD ─────────────────────────────────────────────────────────
  listAgents: (query: { page?: number; limit?: number; search?: string; enabled?: boolean } = {}) =>
    apiClient.get<PaginatedResult<Agent>>("/ai/agents", {
      query: { page: 1, limit: 50, ...query },
    }),

  getAgent: (id: string) => apiClient.get<Agent>(`/ai/agents/${id}`),

  createAgent: (input: CreateAgentInput) =>
    apiClient.post<Agent>("/ai/agents", input),

  updateAgent: (id: string, input: UpdateAgentInput) =>
    apiClient.patch<Agent>(`/ai/agents/${id}`, input),

  deleteAgent: (id: string) => apiClient.delete<Agent>(`/ai/agents/${id}`),

  // ── Execution ────────────────────────────────────────────────────
  runAgent: (agentId: string, input: RunAgentInput) =>
    apiClient.post<RunAgentResult>(`/ai/agents/${agentId}/run`, input),

  runAgentStream: (
    agentId: string,
    input: RunAgentInput,
  ): Promise<AsyncGenerator<AgentAllStreamEvent>> => {
    const token = tokenStorage.readAccessToken();
    return fetch(`${API_BASE_URL}/ai/agents/${agentId}/run/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    }).then((res) => {
      if (!res.ok) throw new Error(`Stream request failed: ${res.status}`);
      return readSSEStream(res);
    });
  },

  runAutonomous: (agentId: string, input: RunAutonomousInput) =>
    apiClient.post<RunAutonomousResult>(`/ai/agents/${agentId}/run/autonomous`, input),

  runAutonomousStream: (
    agentId: string,
    input: RunAutonomousInput,
  ): Promise<AsyncGenerator<AgentAllStreamEvent>> => {
    const token = tokenStorage.readAccessToken();
    return fetch(`${API_BASE_URL}/ai/agents/${agentId}/run/autonomous/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(input),
    }).then((res) => {
      if (!res.ok) throw new Error(`Stream request failed: ${res.status}`);
      return readSSEStream(res);
    });
  },

  // ── Stats & Tree ─────────────────────────────────────────────────
  getAgentStats: (agentId: string) =>
    apiClient.get<AgentStats>(`/ai/agents/${agentId}/stats`),

  getRunTree: (runId: string) => apiClient.get<AgentRun[]>(`/ai/agents/runs/${runId}/tree`),

  // ── Approvals ────────────────────────────────────────────────────
  listPendingApprovals: (query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<AgentApproval>>("/ai/approvals", {
      query: { page: 1, limit: 20, ...query },
    }),

  decideApproval: (approvalId: string, decision: "APPROVED" | "REJECTED", comment?: string) =>
    apiClient.post<AgentApproval>(`/ai/approvals/${approvalId}/decide`, { decision, comment }),
};
