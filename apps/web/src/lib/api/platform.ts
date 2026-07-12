import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export interface PlatformOrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  parentOrganizationId: string | null;
  memberCount: number;
  createdAt: string;
}

export interface SearchPlatformOrganizationsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export interface PlatformRevenueSummary {
  estimatedMonthlyRecurringRevenueUsd: number;
  totalRevenueCollectedUsd: number;
  outstandingAmountDueUsd: number;
  subscriptionsByStatus: { status: string; count: number }[];
}

export interface PlatformSystemHealth {
  checkedAt: string;
  dependencies: {
    database: { status: string; latencyMs: number };
    redis?: { status: string; latencyMs: number };
  };
  queues: { queue: string; depth: Record<string, number>; recentFailureCount: number }[];
  commsDelivery: { totalMessages: number; failedMessages: number; failureRate: number };
}

export interface OrgHealthScore {
  organizationId: string;
  score: number;
  signals: { name: string; healthy: boolean; detail: string; scorePenalty: number }[];
}

export interface SupportSession {
  id: string;
  platformAdminUserId: string;
  targetOrganizationId: string;
  reason: string;
  status: "ACTIVE" | "ENDED" | "EXPIRED";
  expiresAt: string;
  endedAt: string | null;
  endedById: string | null;
  createdAt: string;
}

export interface StartSupportSessionResult {
  session: SupportSession;
  accessToken: string;
  tokenType: "Bearer";
  expiresIn: number;
}

export const platformApi = {
  searchOrganizations: (params: SearchPlatformOrganizationsParams = {}) =>
    apiClient.get<PaginatedResult<PlatformOrganizationSummary>>("/platform/organizations", {
      query: { ...params },
    }),

  getRevenueSummary: () => apiClient.get<PlatformRevenueSummary>("/platform/revenue/summary"),

  getSystemHealth: () => apiClient.get<PlatformSystemHealth>("/platform/system-health"),

  getOrgHealthScore: (organizationId: string) =>
    apiClient.get<OrgHealthScore>(`/platform/organizations/${organizationId}/health-score`),

  listSupportSessions: () => apiClient.get<SupportSession[]>("/platform/support-sessions"),

  startSupportSession: (input: { targetOrganizationId: string; reason: string }) =>
    apiClient.post<StartSupportSessionResult>("/platform/support-sessions", input),

  endSupportSession: (sessionId: string) =>
    apiClient.delete<SupportSession>(`/platform/support-sessions/${sessionId}`),
};
