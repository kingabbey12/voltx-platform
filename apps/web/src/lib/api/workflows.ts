import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  publishedVersion: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  type: "AGENT" | "TOOL" | "API" | "WEBHOOK" | "NOTIFICATION" | "APPROVAL" | "DELAY" | "INTEGRATION";
  dependsOn?: string[];
  config: Record<string, unknown>;
}

export interface WorkflowDefinition {
  steps: WorkflowStepDefinition[];
}

export type WorkflowRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "PAUSED"
  | "AWAITING_APPROVAL";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: WorkflowRunStatus;
  triggerType: string;
  startedAt: string | null;
  completedAt: string | null;
  error: string | null;
  createdAt: string;
}

export const workflowsApi = {
  list: (query: { page?: number; limit?: number; status?: WorkflowStatus } = {}) =>
    apiClient.get<PaginatedResult<Workflow>>("/workflows", { query: { page: 1, limit: 50, ...query } }),

  get: (id: string) => apiClient.get<Workflow>(`/workflows/${id}`),

  create: (input: { name: string; description?: string; definition: WorkflowDefinition }) =>
    apiClient.post<Workflow>("/workflows", input),

  update: (id: string, input: { name?: string; description?: string; definition?: WorkflowDefinition }) =>
    apiClient.patch<Workflow>(`/workflows/${id}`, input),

  publish: (id: string) => apiClient.post<Workflow>(`/workflows/${id}/publish`),
  archive: (id: string) => apiClient.post<Workflow>(`/workflows/${id}/archive`),
  delete: (id: string) => apiClient.delete<void>(`/workflows/${id}`),

  run: (id: string, input?: Record<string, unknown>) =>
    apiClient.post<WorkflowRun>(`/workflows/${id}/run`, { input }),

  listRuns: (id: string, query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<WorkflowRun>>(`/workflows/${id}/runs`, {
      query: { page: 1, limit: 20, ...query },
    }),

  health: (id: string) =>
    apiClient.get<{ status: string; lastRunAt: string | null; failureRate: number }>(
      `/workflows/${id}/health`,
    ),
};
