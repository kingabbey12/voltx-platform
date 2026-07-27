import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

// ─── Provider credential types ───────────────────────────────────────────

export const AI_PROVIDER_NAMES = [
  "openai",
  "anthropic",
  "google",
  "xai",
  "groq",
  "mistral",
  "deepseek",
  "ollama",
  "openrouter",
  "azure-openai",
] as const;

export type AIProviderName = (typeof AI_PROVIDER_NAMES)[number];

export type AiCredentialStatus = "ACTIVE" | "DISABLED";

export interface AiCredential {
  id: string;
  provider: AIProviderName;
  label: string;
  maskedApiKey: string;
  baseUrl: string | null;
  metadata: Record<string, unknown>;
  status: AiCredentialStatus;
  lastRotatedAt: string | null;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAiCredentialInput {
  provider: AIProviderName;
  apiKey: string;
  label?: string;
  baseUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateAiCredentialInput {
  label?: string;
  baseUrl?: string;
  status?: AiCredentialStatus;
  metadata?: Record<string, unknown>;
}

export interface RotateAiCredentialInput {
  apiKey: string;
}

export interface AiCredentialTestResult {
  status: "ok" | "failed";
  message: string;
  testedAt: string;
}

export const aiCredentialsApi = {
  list: (query?: { provider?: AIProviderName; page?: number; limit?: number }) =>
    apiClient.get<PaginatedResult<AiCredential>>("/ai/credentials", {
      query: { page: 1, limit: 50, ...query },
    }),

  get: (id: string) => apiClient.get<AiCredential>(`/ai/credentials/${id}`),

  create: (input: CreateAiCredentialInput) =>
    apiClient.post<AiCredential>("/ai/credentials", input),

  update: (id: string, input: UpdateAiCredentialInput) =>
    apiClient.patch<AiCredential>(`/ai/credentials/${id}`, input),

  rotate: (id: string, input: RotateAiCredentialInput) =>
    apiClient.post<AiCredential>(`/ai/credentials/${id}/rotate`, input),

  test: (id: string) =>
    apiClient.post<AiCredentialTestResult>(`/ai/credentials/${id}/test`),

  health: () =>
    apiClient.get<AiCredentialTestResult[]>("/ai/credentials/health"),

  delete: (id: string) =>
    apiClient.delete<void>(`/ai/credentials/${id}`),
};

// ─── AI Settings (stored in organization.settings.ai) ────────────────────

export interface AiModelDefaults {
  chat?: string;
  agent?: string;
  embedding?: string;
  reasoning?: string;
}

export interface AiAgentDefaults {
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  contextWindow?: number;
  retryMaxAttempts?: number;
  retryBackoffMs?: number;
  timeoutMs?: number;
  monthlyCostLimitUsd?: number;
}

export interface AiKnowledgeDefaults {
  embeddingProvider?: string;
  chunkSize?: number;
  chunkOverlap?: number;
  retrievalTopK?: number;
  similarityThreshold?: number;
  enableReranking?: boolean;
}

export interface AiWorkflowDefaults {
  parallelExecution?: boolean;
  retryMaxAttempts?: number;
  retryBackoffMs?: number;
  requireApproval?: boolean;
  executionTimeoutMs?: number;
}

export interface AiUsageLimits {
  dailyTokenLimit?: number;
  monthlyBudgetUsd?: number;
  perUserDailyQuota?: number;
  perOrgMonthlyQuota?: number;
  rateLimitPerMinute?: number;
}

export interface AiSecurity {
  encryptCredentials?: boolean;
  autoRotateDays?: number;
  auditLogEnabled?: boolean;
  restrictToRoles?: string[];
}

export interface AiSystemSettings {
  featureFlags?: string[];
  loggingLevel?: "debug" | "info" | "warn" | "error";
  streamingEnabled?: boolean;
  backgroundJobsEnabled?: boolean;
  cacheTtlMs?: number;
}

export interface AiSettings {
  models?: AiModelDefaults;
  agentDefaults?: AiAgentDefaults;
  knowledgeDefaults?: AiKnowledgeDefaults;
  workflowDefaults?: AiWorkflowDefaults;
  usageLimits?: AiUsageLimits;
  security?: AiSecurity;
  system?: AiSystemSettings;
}

export interface OrganizationProfile {
  id: string;
  name: string;
  settings?: Record<string, unknown>;
}

export const aiSettingsApi = {
  /** Read AI settings from the current organization profile. */
  get: async (orgId: string): Promise<AiSettings> => {
    const org = await apiClient.get<OrganizationProfile>(
      `/organizations/${orgId}`,
    );
    const settings = org.settings;
    return ((settings?.ai as AiSettings) ?? {}) as AiSettings;
  },

  /** Patch AI settings inside the organization settings JSON. */
  update: async (
    orgId: string,
    partial: Partial<AiSettings>,
  ): Promise<AiSettings> => {
    const org = await apiClient.get<OrganizationProfile>(
      `/organizations/${orgId}`,
    );
    const current = ((org.settings?.ai as AiSettings) ?? {}) as AiSettings;
    const merged: AiSettings = { ...current, ...partial };
    const updated = await apiClient.patch<OrganizationProfile>(
      `/organizations/${orgId}`,
      { settings: { ...org.settings, ai: merged } },
    );
    return (updated.settings?.ai as AiSettings) ?? {};
  },
};
