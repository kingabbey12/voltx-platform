import type { VoltxClient } from "@voltx/sdk";

/**
 * Thin, hand-written domain calls for the workflow endpoints the CLI needs
 * — every one goes through the shared @voltx/sdk VoltxClient (its generic
 * get/post/patch methods, which already handle auth headers, envelope
 * unwrapping, and error mapping). Workflow-specific types live here rather
 * than in the general-purpose SDK package, the same way apps/web and
 * apps/mobile each maintain their own per-domain API modules atop a shared
 * low-level client.
 */

export type WorkflowStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

export interface Workflow {
  id: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  publishedVersion: number | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type WorkflowRunStatus =
  | "PENDING"
  | "RUNNING"
  | "PAUSED"
  | "WAITING_APPROVAL"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

export const TERMINAL_RUN_STATUSES: readonly WorkflowRunStatus[] = [
  "SUCCEEDED",
  "FAILED",
  "CANCELLED",
  "TIMED_OUT",
];

export interface WorkflowRun {
  id: string;
  workflowId: string;
  workflowVersionId: string;
  status: WorkflowRunStatus;
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

export interface WorkflowDefinition {
  steps: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export class WorkflowsApi {
  constructor(private readonly client: VoltxClient) {}

  list(query: { page?: number; limit?: number; search?: string } = {}): Promise<PaginatedResult<Workflow>> {
    return this.client.get<PaginatedResult<Workflow>>("/workflows", { query });
  }

  get(id: string): Promise<Workflow> {
    return this.client.get<Workflow>(`/workflows/${id}`);
  }

  create(input: { name: string; description?: string; definition: WorkflowDefinition }): Promise<Workflow> {
    return this.client.post<Workflow>("/workflows", input);
  }

  /** Providing `definition` here creates a brand-new WorkflowVersion. */
  update(id: string, input: { name?: string; description?: string; definition?: WorkflowDefinition }): Promise<Workflow> {
    return this.client.patch<Workflow>(`/workflows/${id}`, input);
  }

  publish(id: string): Promise<Workflow> {
    return this.client.post<Workflow>(`/workflows/${id}/publish`);
  }

  run(id: string, input?: { input?: Record<string, unknown>; idempotencyKey?: string }): Promise<WorkflowRun> {
    return this.client.post<WorkflowRun>(`/workflows/${id}/run`, input);
  }

  getRun(runId: string): Promise<WorkflowRun> {
    return this.client.get<WorkflowRun>(`/workflows/runs/${runId}`);
  }

  getLogs(runId: string, query: { page?: number; limit?: number } = {}): Promise<PaginatedResult<WorkflowLog>> {
    return this.client.get<PaginatedResult<WorkflowLog>>(`/workflows/runs/${runId}/logs`, { query });
  }
}
