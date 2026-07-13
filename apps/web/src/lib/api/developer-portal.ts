import { API_BASE_URL } from "@/config/env";
import { apiClient } from "./client";

// ---------------------------------------------------------------------------
// Personal Access Tokens — user-scoped, not org-scoped (see backend
// PersonalAccessTokenGuard: a PAT-authenticated request states which org
// it's acting in via a header, not a URL segment).
// ---------------------------------------------------------------------------

export interface PersonalAccessToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopedPermissions: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreatePersonalAccessTokenInput {
  name: string;
  scopedPermissions: string[];
  expiresAt?: string;
}

export interface CreatePersonalAccessTokenResult extends PersonalAccessToken {
  token: string;
}

export const personalAccessTokensApi = {
  list: () => apiClient.get<PersonalAccessToken[]>("/developer/personal-access-tokens"),
  create: (input: CreatePersonalAccessTokenInput) =>
    apiClient.post<CreatePersonalAccessTokenResult>("/developer/personal-access-tokens", input),
  revoke: (id: string) => apiClient.delete<void>(`/developer/personal-access-tokens/${id}`),
};

// ---------------------------------------------------------------------------
// Service Accounts — org-scoped machine identities backed by a real
// Membership (see backend ServiceAccountService).
// ---------------------------------------------------------------------------

export type ServiceAccountStatus = "ACTIVE" | "SUSPENDED";

export interface ServiceAccount {
  id: string;
  name: string;
  description: string | null;
  status: ServiceAccountStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceAccountInput {
  name: string;
  description?: string;
  roleId: string;
}

export interface ServiceAccountToken {
  id: string;
  name: string;
  tokenPrefix: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateServiceAccountTokenResult extends ServiceAccountToken {
  token: string;
}

export const serviceAccountsApi = {
  list: (organizationId: string) =>
    apiClient.get<ServiceAccount[]>(`/organizations/${organizationId}/service-accounts`),
  create: (organizationId: string, input: CreateServiceAccountInput) =>
    apiClient.post<ServiceAccount>(`/organizations/${organizationId}/service-accounts`, input),
  suspend: (organizationId: string, id: string) =>
    apiClient.post<ServiceAccount>(`/organizations/${organizationId}/service-accounts/${id}/suspend`),
  reactivate: (organizationId: string, id: string) =>
    apiClient.post<ServiceAccount>(`/organizations/${organizationId}/service-accounts/${id}/reactivate`),
  listTokens: (organizationId: string, id: string) =>
    apiClient.get<ServiceAccountToken[]>(
      `/organizations/${organizationId}/service-accounts/${id}/tokens`,
    ),
  createToken: (organizationId: string, id: string, input: { name: string; expiresAt?: string }) =>
    apiClient.post<CreateServiceAccountTokenResult>(
      `/organizations/${organizationId}/service-accounts/${id}/tokens`,
      input,
    ),
  revokeToken: (organizationId: string, id: string, tokenId: string) =>
    apiClient.delete<void>(
      `/organizations/${organizationId}/service-accounts/${id}/tokens/${tokenId}`,
    ),
};

// ---------------------------------------------------------------------------
// OAuth Applications — Voltx as an OAuth 2.0 authorization server.
// ---------------------------------------------------------------------------

export type OAuthApplicationStatus = "ACTIVE" | "SUSPENDED";

export interface OAuthApplication {
  id: string;
  name: string;
  description: string | null;
  logoUrl: string | null;
  clientId: string;
  clientSecretPrefix: string;
  scopes: string[];
  redirectUris: string[];
  status: OAuthApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOAuthApplicationInput {
  name: string;
  description?: string;
  logoUrl?: string;
  redirectUris: string[];
  scopes: string[];
}

export interface UpdateOAuthApplicationInput {
  name?: string;
  description?: string;
  logoUrl?: string;
  redirectUris?: string[];
  scopes?: string[];
}

export interface CreateOAuthApplicationResult extends OAuthApplication {
  clientSecret: string;
}

export const oauthApplicationsApi = {
  list: (organizationId: string) =>
    apiClient.get<OAuthApplication[]>(`/organizations/${organizationId}/oauth-applications`),
  create: (organizationId: string, input: CreateOAuthApplicationInput) =>
    apiClient.post<CreateOAuthApplicationResult>(
      `/organizations/${organizationId}/oauth-applications`,
      input,
    ),
  update: (organizationId: string, id: string, input: UpdateOAuthApplicationInput) =>
    apiClient.patch<OAuthApplication>(
      `/organizations/${organizationId}/oauth-applications/${id}`,
      input,
    ),
  rotateSecret: (organizationId: string, id: string) =>
    apiClient.post<{ clientSecretPrefix: string; clientSecret: string }>(
      `/organizations/${organizationId}/oauth-applications/${id}/rotate-secret`,
    ),
  suspend: (organizationId: string, id: string) =>
    apiClient.post<OAuthApplication>(
      `/organizations/${organizationId}/oauth-applications/${id}/suspend`,
    ),
  reactivate: (organizationId: string, id: string) =>
    apiClient.post<OAuthApplication>(
      `/organizations/${organizationId}/oauth-applications/${id}/reactivate`,
    ),
  delete: (organizationId: string, id: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/oauth-applications/${id}`),
};

// ---------------------------------------------------------------------------
// Webhook Endpoints — outbound event delivery.
// ---------------------------------------------------------------------------

export type WebhookEndpointStatus = "ACTIVE" | "SUSPENDED";

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  eventTypes: string[];
  status: WebhookEndpointStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookEndpointInput {
  url: string;
  description?: string;
  eventTypes: string[];
}

export interface UpdateWebhookEndpointInput {
  url?: string;
  description?: string;
  eventTypes?: string[];
}

export interface CreateWebhookEndpointResult extends WebhookEndpoint {
  secret: string;
}

export type WebhookDeliveryStatus = "PENDING" | "SUCCEEDED" | "FAILED" | "EXHAUSTED";

export interface WebhookDelivery {
  id: string;
  eventType: string;
  payload: unknown;
  status: WebhookDeliveryStatus;
  responseStatusCode: number | null;
  responseBody: string | null;
  attemptCount: number;
  deliveredAt: string | null;
  createdAt: string;
}

/** The fixed event catalog developers can subscribe a webhook endpoint to —
 * mirrors backend WEBHOOK_EVENT_CATALOG (webhook-event.catalog.ts). Kept as
 * a small static list here rather than fetched, since it changes only when
 * a new event type ships (a code change on both sides regardless). */
export const WEBHOOK_EVENT_CATALOG: { key: string; description: string }[] = [
  { key: "sales.lead.created", description: "A new sales lead was created" },
  { key: "workflow.run.completed", description: "A workflow run finished successfully" },
  { key: "workflow.run.failed", description: "A workflow run finished with a failure" },
  {
    key: "oauth_application.authorized",
    description: "A user approved an OAuth application to act on their behalf",
  },
];

export const webhookEndpointsApi = {
  list: (organizationId: string) =>
    apiClient.get<WebhookEndpoint[]>(`/organizations/${organizationId}/webhook-endpoints`),
  get: (organizationId: string, id: string) =>
    apiClient.get<WebhookEndpoint>(`/organizations/${organizationId}/webhook-endpoints/${id}`),
  create: (organizationId: string, input: CreateWebhookEndpointInput) =>
    apiClient.post<CreateWebhookEndpointResult>(
      `/organizations/${organizationId}/webhook-endpoints`,
      input,
    ),
  update: (organizationId: string, id: string, input: UpdateWebhookEndpointInput) =>
    apiClient.patch<WebhookEndpoint>(
      `/organizations/${organizationId}/webhook-endpoints/${id}`,
      input,
    ),
  rotateSecret: (organizationId: string, id: string) =>
    apiClient.post<{ secret: string }>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/rotate-secret`,
    ),
  suspend: (organizationId: string, id: string) =>
    apiClient.post<WebhookEndpoint>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/suspend`,
    ),
  reactivate: (organizationId: string, id: string) =>
    apiClient.post<WebhookEndpoint>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/reactivate`,
    ),
  delete: (organizationId: string, id: string) =>
    apiClient.delete<void>(`/organizations/${organizationId}/webhook-endpoints/${id}`),
  listDeliveries: (organizationId: string, id: string) =>
    apiClient.get<WebhookDelivery[]>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/deliveries`,
    ),
  replayDelivery: (organizationId: string, id: string, deliveryId: string) =>
    apiClient.post<WebhookDelivery>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/deliveries/${deliveryId}/replay`,
    ),
};

// ---------------------------------------------------------------------------
// OpenAPI document — served at the bare origin (no /api/v1 prefix, no
// {success,data,meta} envelope), so it's fetched directly rather than
// through apiClient.
// ---------------------------------------------------------------------------

export interface OpenApiOperation {
  method: string;
  path: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: {
    name: string;
    in: string;
    required?: boolean;
    description?: string;
    schema?: Record<string, unknown>;
  }[];
  requestBody?: unknown;
}

export interface OpenApiDocument {
  openapi: string;
  info: { title: string; version: string; description?: string };
  paths: Record<string, Record<string, Record<string, unknown>>>;
}

function apiOrigin(): string {
  return new URL(API_BASE_URL).origin;
}

export const openApiDocsApi = {
  fetchDocument: async (): Promise<OpenApiDocument> => {
    const response = await fetch(`${apiOrigin()}/api-json`, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`Failed to load the API reference document (status ${response.status})`);
    }
    return (await response.json()) as OpenApiDocument;
  },
};

/** Flattens the OpenAPI document's paths into a searchable operation list —
 * used by both the API docs viewer and the interactive playground. */
export function flattenOperations(document: OpenApiDocument): OpenApiOperation[] {
  const operations: OpenApiOperation[] = [];
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, operation] of Object.entries(methods)) {
      const op = operation as {
        summary?: string;
        description?: string;
        tags?: string[];
        parameters?: OpenApiOperation["parameters"];
        requestBody?: unknown;
      };
      operations.push({
        method: method.toUpperCase(),
        path,
        summary: op.summary,
        description: op.description,
        tags: op.tags,
        parameters: op.parameters,
        requestBody: op.requestBody,
      });
    }
  }
  return operations;
}

/** Fires a real authenticated request against the live backend using a
 * developer's own Personal Access Token — the playground never uses a mock
 * server. The PAT is attached in-memory for this single request only and
 * is never persisted (see the playground page for the accompanying UI copy
 * making that explicit). */
export async function playgroundRequest(input: {
  method: string;
  path: string;
  organizationId: string;
  personalAccessToken: string;
  query?: string;
  body?: string;
}): Promise<{ status: number; body: unknown }> {
  const url = new URL(`${apiOrigin()}/api/v1${input.path}`);
  if (input.query) {
    const params = new URLSearchParams(input.query);
    for (const [key, value] of params.entries()) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Personal-Access-Token": input.personalAccessToken,
    "X-Organization-Id": input.organizationId,
  };
  const hasBody = input.method !== "GET" && input.method !== "DELETE" && !!input.body;
  if (hasBody) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(url.toString(), {
    method: input.method,
    headers,
    body: hasBody ? input.body : undefined,
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // No JSON body — leave as null.
  }

  return { status: response.status, body };
}
