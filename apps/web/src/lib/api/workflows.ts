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

export type WorkflowStepType =
  | "AGENT"
  | "TOOL"
  | "API"
  | "WEBHOOK"
  | "NOTIFICATION"
  | "APPROVAL"
  | "DELAY"
  | "INTEGRATION"
  | "LOOP"
  | "SWITCH";

export type StepConditionOperator =
  | "eq"
  | "neq"
  | "exists"
  | "not_exists"
  | "truthy"
  | "falsy"
  | "gt"
  | "lt"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "regex"
  | "date_gt"
  | "date_lt"
  | "empty"
  | "not_empty";

export interface StepConditionLeaf {
  path: string;
  operator: StepConditionOperator;
  value?: unknown;
}

export type StepCondition =
  | StepConditionLeaf
  | { and: StepCondition[] }
  | { or: StepCondition[] }
  | { not: StepCondition };

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier?: number;
}

export interface WorkflowStepDefinition {
  id: string;
  name: string;
  type: WorkflowStepType;
  dependsOn?: string[];
  condition?: StepCondition;
  retryPolicy?: RetryPolicy;
  timeoutMs?: number;
  config: Record<string, unknown>;
  /** UI-only layout metadata (position, comment text) — the engine ignores this entirely. */
  layout?: { x: number; y: number };
}

export interface WorkflowDefinition {
  steps: WorkflowStepDefinition[];
  defaultRetryPolicy?: RetryPolicy;
  defaultTimeoutMs?: number;
}

export interface WorkflowVersion {
  id: string;
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
  createdBy: string;
  createdAt: string;
}

// The backend's actual value is WAITING_APPROVAL — this client previously
// (incorrectly) expected AWAITING_APPROVAL, meaning a paused-for-approval
// run's status could never be recognized by the UI. Fixed here.
export type WorkflowRunStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "PAUSED"
  | "WAITING_APPROVAL"
  | "TIMED_OUT";

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  status: WorkflowRunStatus;
  triggerType: string;
  input: Record<string, unknown>;
  context: Record<string, unknown>;
  output: Record<string, unknown>;
  currentStepId: string | null;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  durationMs: number | null;
  createdAt: string;
}

export interface WorkflowLog {
  id: string;
  workflowRunId: string;
  stepRunId: string | null;
  level: "DEBUG" | "INFO" | "WARN" | "ERROR";
  event: string;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowCheckpoint {
  id: string;
  workflowRunId: string;
  stepId: string;
  state: Record<string, unknown>;
  createdAt: string;
}

export interface WorkflowMetrics {
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  successRate: number;
  failureRate: number;
  // Postgres NUMERIC aggregates (AVG()) come back from the driver as strings,
  // not numbers — coerce with Number(...) before doing arithmetic on these.
  averageExecutionTimeMs: number | string;
  averageQueueTimeMs: number | string;
  totalRetries: number;
  agentStepCount: number;
  toolStepCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface WorkflowHealth {
  status: "HEALTHY" | "DEGRADED" | "UNHEALTHY" | "UNKNOWN";
  lastRunAt: string | null;
  failureRate: number;
}

export interface WorkflowDeadLetter {
  id: string;
  organizationId: string;
  workflowRunId: string;
  stepId: string;
  reason: string;
  payload: Record<string, unknown>;
  createdAt: string;
}

export type WorkflowTriggerType = "MANUAL" | "IMMEDIATE" | "DELAYED" | "CRON" | "EVENT" | "API";

export interface WorkflowSchedule {
  id: string;
  workflowId: string;
  triggerType: WorkflowTriggerType;
  cronExpression: string | null;
  delayMs: number | null;
  eventName: string | null;
  input: Record<string, unknown>;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

export interface WorkflowApproval {
  id: string;
  workflowRunId: string;
  stepRunId: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  approverUserId: string | null;
  comment: string | null;
  expiresAt: string | null;
  decidedAt: string | null;
  createdAt: string;
}

export interface WorkflowTemplate {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  description: string | null;
  category: string;
  definition: WorkflowDefinition;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowSecret {
  id: string;
  key: string;
  description: string | null;
  lastRotatedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
}

export interface WorkflowWebhook {
  id: string;
  workflowId: string;
  token: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
  createdAt: string;
}

export interface WorkflowWebhookCreated extends WorkflowWebhook {
  secret: string;
}

export type WorkflowVariableType = "STRING" | "NUMBER" | "BOOLEAN" | "JSON";
export interface WorkflowVariable {
  id: string;
  workflowId: string | null;
  key: string;
  type: WorkflowVariableType;
  defaultValue: unknown;
  description: string | null;
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

  listVersions: (id: string) => apiClient.get<WorkflowVersion[]>(`/workflows/${id}/versions`),

  run: (id: string, input?: Record<string, unknown>) =>
    apiClient.post<WorkflowRun>(`/workflows/${id}/run`, { input }),

  listRuns: (id: string, query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<WorkflowRun>>(`/workflows/${id}/runs`, {
      query: { page: 1, limit: 20, ...query },
    }),

  getRun: (runId: string) => apiClient.get<WorkflowRun>(`/workflows/runs/${runId}`),
  pauseRun: (runId: string) => apiClient.post<WorkflowRun>(`/workflows/runs/${runId}/pause`),
  resumeRun: (runId: string) => apiClient.post<WorkflowRun>(`/workflows/runs/${runId}/resume`),
  cancelRun: (runId: string) => apiClient.post<WorkflowRun>(`/workflows/runs/${runId}/cancel`),
  retryRun: (runId: string) => apiClient.post<WorkflowRun>(`/workflows/runs/${runId}/retry`),

  listRunLogs: (runId: string, query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<WorkflowLog>>(`/workflows/runs/${runId}/logs`, {
      query: { page: 1, limit: 50, ...query },
    }),

  listRunCheckpoints: (runId: string) =>
    apiClient.get<WorkflowCheckpoint[]>(`/workflows/runs/${runId}/checkpoints`),

  health: (id: string) => apiClient.get<WorkflowHealth>(`/workflows/${id}/health`),
  metrics: (id: string) => apiClient.get<WorkflowMetrics>(`/workflows/${id}/metrics`),

  listDeadLetters: (query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<WorkflowDeadLetter>>("/workflows/dead-letters", {
      query: { page: 1, limit: 20, ...query },
    }),

  listSchedules: (id: string) => apiClient.get<WorkflowSchedule[]>(`/workflows/${id}/schedules`),
  createSchedule: (
    id: string,
    input: {
      triggerType: WorkflowTriggerType;
      cronExpression?: string;
      delayMs?: number;
      eventName?: string;
      input?: Record<string, unknown>;
    },
  ) => apiClient.post<WorkflowSchedule>(`/workflows/${id}/schedules`, input),
  setScheduleEnabled: (id: string, scheduleId: string, enabled: boolean) =>
    apiClient.patch<WorkflowSchedule>(`/workflows/${id}/schedules/${scheduleId}`, { enabled }),

  listApprovals: (query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<WorkflowApproval>>("/workflows/approvals", {
      query: { page: 1, limit: 20, ...query },
    }),
  decideApproval: (approvalId: string, decision: "APPROVED" | "REJECTED", comment?: string) =>
    apiClient.post<WorkflowApproval>(`/workflows/approvals/${approvalId}/decide`, {
      decision,
      comment,
    }),
};

export const workflowTemplatesApi = {
  list: (query: { page?: number; limit?: number; category?: string } = {}) =>
    apiClient.get<PaginatedResult<WorkflowTemplate>>("/workflows/templates", {
      query: { page: 1, limit: 50, ...query },
    }),
  get: (key: string) => apiClient.get<WorkflowTemplate>(`/workflows/templates/${key}`),
  create: (input: {
    key: string;
    name: string;
    description?: string;
    category: string;
    definition: WorkflowDefinition;
  }) => apiClient.post<WorkflowTemplate>("/workflows/templates", input),
  instantiate: (key: string, name?: string) =>
    apiClient.post<Workflow>(`/workflows/templates/${key}/instantiate`, { name }),
  delete: (id: string) => apiClient.delete<WorkflowTemplate>(`/workflows/templates/${id}`),
};

export const workflowSecretsApi = {
  list: () => apiClient.get<WorkflowSecret[]>("/workflows/secrets"),
  create: (input: { key: string; value: string; description?: string }) =>
    apiClient.post<WorkflowSecret>("/workflows/secrets", input),
  rotate: (id: string, value: string) =>
    apiClient.post<WorkflowSecret>(`/workflows/secrets/${id}/rotate`, { value }),
  delete: (id: string) => apiClient.delete<WorkflowSecret>(`/workflows/secrets/${id}`),
};

export const workflowWebhooksApi = {
  list: (workflowId: string) => apiClient.get<WorkflowWebhook[]>(`/workflows/${workflowId}/webhooks`),
  create: (workflowId: string) =>
    apiClient.post<WorkflowWebhookCreated>(`/workflows/${workflowId}/webhooks`),
  setEnabled: (webhookId: string, enabled: boolean) =>
    apiClient.patch<WorkflowWebhook>(`/workflows/webhooks/${webhookId}`, { enabled }),
  delete: (webhookId: string) => apiClient.delete<WorkflowWebhook>(`/workflows/webhooks/${webhookId}`),
};

export const workflowVariablesApi = {
  listOrg: () => apiClient.get<WorkflowVariable[]>("/workflows/variables"),
  listForWorkflow: (workflowId: string) =>
    apiClient.get<WorkflowVariable[]>(`/workflows/${workflowId}/variables`),
  createOrg: (input: {
    key: string;
    type?: WorkflowVariableType;
    defaultValue?: unknown;
    description?: string;
  }) => apiClient.post<WorkflowVariable>("/workflows/variables", input),
  createForWorkflow: (
    workflowId: string,
    input: { key: string; type?: WorkflowVariableType; defaultValue?: unknown; description?: string },
  ) => apiClient.post<WorkflowVariable>(`/workflows/${workflowId}/variables`, input),
  update: (
    variableId: string,
    input: { type?: WorkflowVariableType; defaultValue?: unknown; description?: string },
  ) => apiClient.patch<WorkflowVariable>(`/workflows/variables/${variableId}`, input),
  delete: (variableId: string) =>
    apiClient.delete<WorkflowVariable>(`/workflows/variables/${variableId}`),
};
