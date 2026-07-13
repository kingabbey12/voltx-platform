import type { components } from "./generated/schema.js";

export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: components["schemas"]["ApiResponseMetaDto"];
}

export interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details?: unknown };
  meta: { requestId: string; timestamp: string; path: string; statusCode: number; version: string };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

/**
 * Hand-declared response shapes for the Developer Platform resource
 * surface. NestJS Swagger cannot resolve the generic
 * `ApiSuccessResponseDto<T>`'s `data` field to a concrete schema (see
 * backend openapi-3.1.util.ts / Phase 1 notes), so openapi-typescript only
 * ever generates `data: Record<string, never>` for these endpoints —
 * these interfaces are hand-maintained to match the real backend DTOs
 * exactly (src/modules/developer-platform, src/modules/oauth-provider,
 * src/modules/webhooks). Request bodies, by contrast, ARE fully generated
 * (see the resource files' use of `components["schemas"][...]`) since
 * `@Body()` parameter introspection works correctly today.
 */

// Personal Access Tokens
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
export interface CreatePersonalAccessTokenResult extends PersonalAccessToken {
  token: string;
}

// Service Accounts
export type ServiceAccountStatus = "ACTIVE" | "SUSPENDED";
export interface ServiceAccount {
  id: string;
  name: string;
  description: string | null;
  status: ServiceAccountStatus;
  createdAt: string;
  updatedAt: string;
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

// OAuth Applications
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
export interface CreateOAuthApplicationResult extends OAuthApplication {
  clientSecret: string;
}
export interface RotateOAuthApplicationSecretResult {
  clientSecretPrefix: string;
  clientSecret: string;
}

// Webhook Endpoints
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
export interface CreateWebhookEndpointResult extends WebhookEndpoint {
  secret: string;
}
export interface RotateWebhookEndpointSecretResult {
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

// OAuth token endpoint (RFC 6749/7662 wire shape — snake_case, un-enveloped)
export interface OAuthTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
  refresh_token: string;
  scope: string;
}
export interface OAuthIntrospectResponse {
  active: boolean;
  scope?: string;
  client_id?: string;
  sub?: string;
  exp?: number;
  iat?: number;
  token_type?: "access_token" | "refresh_token";
}
