import { apiClient } from "./client";
import type { PaginatedResult } from "./types";
import type { AgentApproval, AgentRun } from "./agents";

export interface AiTasksSummary {
  pendingApprovals: AgentApproval[];
  inProgressRuns: AgentRun[];
}

export interface AgentPerformanceEntry {
  agentId: string | null;
  agentName: string | null;
  callCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface AiPerformanceSummary {
  lookbackDays: number;
  totalCallCount: number;
  totalTokens: number;
  totalCostUsd: number;
  byAgent: AgentPerformanceEntry[];
}

export interface AiSuggestion {
  id: string;
  category: "SALES" | "SUPPORT" | "OPERATIONS" | "FINANCE" | "GENERAL";
  title: string;
  description: string;
  createdAt: string;
}

export const aiDashboardApi = {
  getActivity: (query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<AgentRun>>("/ai/dashboard/activity", {
      query: { page: 1, limit: 20, ...query },
    }),

  getPerformance: (lookbackDays = 30) =>
    apiClient.get<AiPerformanceSummary>("/ai/dashboard/performance", {
      query: { lookbackDays },
    }),

  getTasks: () => apiClient.get<AiTasksSummary>("/ai/dashboard/tasks"),

  getSuggestions: () => apiClient.get<AiSuggestion[]>("/ai/dashboard/suggestions"),

  dismissSuggestion: (id: string) =>
    apiClient.patch<{ dismissed: boolean }>(`/ai/dashboard/suggestions/${id}/dismiss`),
};
