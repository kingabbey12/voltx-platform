import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export interface IntegrationConnection {
  id: string;
  provider: string;
  displayName: string;
  authType: string;
  status: string;
  externalAccountId: string | null;
  version: number;
  lastHealthCheckAt: string | null;
  lastHealthStatus: string;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationPageQuery {
  page?: number;
  limit?: number;
  provider?: string;
  status?: string;
}

export const integrationsApi = {
  list: (query: IntegrationPageQuery = {}) =>
    apiClient.get<PaginatedResult<IntegrationConnection>>("/integrations/connections", {
      query: { page: 1, limit: 50, ...query },
    }),

  get: (id: string) => apiClient.get<IntegrationConnection>(`/integrations/connections/${id}`),

  createApiKeyConnection: (input: {
    provider: string;
    displayName: string;
    apiKey?: string;
    webhookSecret?: string;
  }) => apiClient.post<IntegrationConnection>("/integrations/connections", input),

  initiateOAuth: (input: { provider: string; displayName: string; redirectUri: string }) =>
    apiClient.post<{ connectionId: string; authorizationUrl: string }>(
      "/integrations/connections/oauth/initiate",
      input,
    ),

  completeOAuth: (input: { connectionId: string; code: string; redirectUri: string }) =>
    apiClient.post<IntegrationConnection>("/integrations/connections/oauth/complete", input),

  healthCheck: (id: string) =>
    apiClient.post<{ healthy: boolean; latencyMs: number; message?: string }>(
      `/integrations/connections/${id}/health-check`,
    ),

  sync: (id: string) =>
    apiClient.post<{ itemsProcessed: number; itemsFailed: number; status: string }>(
      `/integrations/connections/${id}/sync`,
    ),

  delete: (id: string) => apiClient.delete<void>(`/integrations/connections/${id}`),

  revoke: (id: string) => apiClient.post<IntegrationConnection>(`/integrations/connections/${id}/revoke`),
};

export const OAUTH_PROVIDER_KEYS = [
  "GOOGLE_GMAIL",
  "GOOGLE_CALENDAR",
  "GOOGLE_DRIVE",
  "MICROSOFT_OUTLOOK",
  "MICROSOFT_CALENDAR",
  "MICROSOFT_ONEDRIVE",
  "SLACK",
  "MICROSOFT_TEAMS",
  "GITHUB",
] as const;

// OAuth2 providers with a configured connector + working Connect action
// beyond Google (backend/src/modules/integrations/provider/oauth-provider-configs.ts).
// Providers in OAUTH_PROVIDER_KEYS but not here (MICROSOFT_CALENDAR,
// MICROSOFT_ONEDRIVE, GITHUB) don't have an app registration for this
// environment yet and stay non-interactive.
export const LIVE_OAUTH_PROVIDER_KEYS = ["MICROSOFT_OUTLOOK", "MICROSOFT_TEAMS", "SLACK"] as const;

export const API_KEY_PROVIDER_KEYS = ["STRIPE", "WEBHOOK", "REST_API"] as const;
