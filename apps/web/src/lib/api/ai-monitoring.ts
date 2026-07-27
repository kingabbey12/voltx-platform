import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

// ─── Health ──────────────────────────────────────────────────────────────

export interface HealthDependency {
  status: "up" | "down";
  latencyMs: number;
}

export interface HealthData {
  status: "ok";
  timestamp: string;
  uptime: number;
  dependencies: {
    database: HealthDependency;
    redis?: HealthDependency;
  };
}

export const healthApi = {
  get: () => apiClient.get<HealthData>("/health"),
};

// ─── Platform System Health ──────────────────────────────────────────────

export interface QueueDepth {
  queue: string;
  depth: Record<string, number>;
  recentFailureCount: number;
}

export interface PlatformSystemHealth {
  checkedAt: string;
  dependencies: {
    database: HealthDependency;
    redis?: HealthDependency;
  };
  queues: QueueDepth[];
  commsDelivery?: {
    totalMessages: number;
    failedMessages: number;
    failureRate: number;
  };
}

export const platformHealthApi = {
  get: () => apiClient.get<PlatformSystemHealth>("/platform/system-health"),
};

// ─── Alerts / Incidents ──────────────────────────────────────────────────

export type AlertSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";

export interface PlatformAlert {
  id: string;
  severity: AlertSeverity;
  category: string;
  status: AlertStatus;
  title: string;
  description: string | null;
  sourceMetadata: Record<string, unknown>;
  organizationId: string | null;
  acknowledgedById: string | null;
  acknowledgedAt: string | null;
  resolvedById: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertInput {
  severity: AlertSeverity;
  category: string;
  title: string;
  description?: string;
  sourceMetadata?: Record<string, unknown>;
  organizationId?: string;
}

export const alertsApi = {
  list: (query?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
    category?: string;
    page?: number;
    limit?: number;
  }) =>
    apiClient.get<PaginatedResult<PlatformAlert>>("/platform/alerts", {
      query: { page: 1, limit: 50, ...query },
    }),

  get: (id: string) => apiClient.get<PlatformAlert>(`/platform/alerts/${id}`),

  create: (input: CreateAlertInput) =>
    apiClient.post<PlatformAlert>("/platform/alerts", input),

  acknowledge: (id: string) =>
    apiClient.post<PlatformAlert>(`/platform/alerts/${id}/acknowledge`),

  resolve: (id: string) =>
    apiClient.post<PlatformAlert>(`/platform/alerts/${id}/resolve`),

  delete: (id: string) =>
    apiClient.delete<void>(`/platform/alerts/${id}`),
};

// ─── Knowledge Stats ─────────────────────────────────────────────────────

export interface KnowledgeStats {
  indexSize: {
    sourceCount: number;
    documentCount: number;
    chunkCount: number;
    entityCount: number;
    relationshipCount: number;
  };
  embedding: {
    callCount: number;
    averageLatencyMs: number;
    totalCostUsd: number;
  };
  retrieval: {
    searchCount: number;
    averageLatencyMs: number;
    hitRate: number;
    cacheHitRate: number;
    averageConfidence: number;
  };
}

export interface KnowledgeHealth {
  healthy: boolean;
  reasons: string[];
}

export const knowledgeStatsApi = {
  stats: () => apiClient.get<KnowledgeStats>("/knowledge/stats"),
  health: () => apiClient.get<KnowledgeHealth>("/knowledge/health"),
};

// ─── Workflow Observability ──────────────────────────────────────────────

export interface WorkflowMetricsSummary {
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  successRate: number;
  failureRate: number;
  averageExecutionTimeMs: number;
  averageQueueTimeMs: number;
  totalRetries: number;
  agentStepCount: number;
  toolStepCount: number;
  totalTokens: number;
  totalCostUsd: number;
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

// ─── Background Job Failures ─────────────────────────────────────────────

export interface BackgroundJobFailure {
  id: string;
  organizationId: string | null;
  queueName: string;
  jobName: string;
  jobId: string | null;
  payload: Record<string, unknown>;
  failureReason: string;
  attemptsMade: number;
  createdAt: string;
}

export const backgroundJobsApi = {
  deadLetters: (query?: { page?: number; limit?: number }) =>
    apiClient.get<PaginatedResult<BackgroundJobFailure>>("/ops/dead-letters", {
      query: { page: 1, limit: 20, ...query },
    }),
};
