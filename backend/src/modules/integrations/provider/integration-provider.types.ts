export type IntegrationProviderKey =
  | 'GOOGLE_GMAIL'
  | 'GOOGLE_CALENDAR'
  | 'GOOGLE_DRIVE'
  | 'MICROSOFT_OUTLOOK'
  | 'MICROSOFT_CALENDAR'
  | 'MICROSOFT_ONEDRIVE'
  | 'SLACK'
  | 'MICROSOFT_TEAMS'
  | 'GITHUB'
  | 'STRIPE'
  | 'WEBHOOK'
  | 'REST_API';

export type IntegrationAuthType = 'OAUTH2' | 'API_KEY' | 'WEBHOOK_SECRET' | 'NONE';

/** Decrypted, ready-to-use credential handed to a connector for one call — never persisted or logged as-is. */
export interface IntegrationCredentialValue {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  tokenType?: string;
  expiresAt?: Date;
  extra?: Record<string, unknown>;
}

export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthorizationParams?: Record<string, string>;
  usesPkce?: boolean;
}

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope?: string;
  extra?: Record<string, unknown>;
}

export interface IntegrationActionDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        description: string;
        required?: boolean;
      }
    >;
  };
}

export interface IntegrationActionContext {
  organizationId: string;
  connectionId: string;
  credential: IntegrationCredentialValue;
  signal?: AbortSignal;
}

export type IntegrationEventType =
  | 'EMAIL_RECEIVED'
  | 'MEETING_CREATED'
  | 'FILE_UPLOADED'
  | 'PAYMENT_RECEIVED'
  | 'SLACK_MESSAGE'
  | 'TEAMS_MESSAGE'
  | 'GITHUB_ISSUE'
  | 'WEBHOOK_RECEIVED'
  | 'API_EVENT'
  | 'CONNECTION_CONNECTED'
  | 'CONNECTION_ERROR'
  | 'TOKEN_REFRESHED';

/** One normalized fact a connector observed (via webhook or poll) — the unit the event bus, knowledge contributor, and dead-letter/idempotency logic all operate on. */
export interface IntegrationParsedEvent {
  type: IntegrationEventType;
  externalId?: string;
  occurredAt?: Date;
  payload: Record<string, unknown>;
  /** Present when this event should also become a Knowledge Graph document (VT-023 reuse). */
  knowledgeContribution?: {
    sourceType: 'EMAIL' | 'CALENDAR' | 'UPLOADED_FILE' | 'MESSAGE' | 'ISSUE' | 'DOCUMENT';
    title: string;
    contentType: string;
    text: string;
    metadata?: Record<string, unknown>;
  };
}

export interface IntegrationPollResult {
  events: IntegrationParsedEvent[];
  nextCursor?: string;
}

export interface IntegrationHealthResult {
  healthy: boolean;
  latencyMs: number;
  message?: string;
}

export interface IntegrationRateLimitInfo {
  limit?: number;
  remaining?: number;
  resetAt?: Date;
}

export class IntegrationProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
    public readonly rateLimit?: IntegrationRateLimitInfo,
  ) {
    super(message);
    this.name = 'IntegrationProviderError';
  }
}

/**
 * The common interface every connector implements (Google/Microsoft/Slack/
 * Teams/GitHub/Stripe/generic webhook/generic REST). OAuth token issuance
 * and refresh are deliberately NOT part of this interface — they're
 * centralized in OAuthService, parameterized per-provider by
 * OAuthProviderConfig, so connectors only ever receive an already-valid
 * decrypted credential and focus purely on the data actions, webhook
 * parsing, and polling for their system.
 */
export interface IntegrationProvider {
  readonly key: IntegrationProviderKey;
  readonly authType: IntegrationAuthType;
  readonly displayName: string;
  readonly supportsWebhooks: boolean;
  readonly supportsPolling: boolean;
  readonly oauthConfig?: OAuthProviderConfig;

  listActions(): IntegrationActionDescriptor[];
  executeAction(
    actionName: string,
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<unknown>;

  checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult>;

  /**
   * Optional: resolve a human-readable identifier (typically the
   * connected account's email) for the credential just obtained via
   * OAuth. Called once, right after token exchange, so the connection
   * can display "connected as x@example.com" instead of only a status
   * badge. Providers that don't implement this simply show no account
   * identity — never fabricated.
   */
  resolveAccountIdentity?(credential: IntegrationCredentialValue): Promise<string | undefined>;

  /** Only required when supportsWebhooks is true. */
  verifyWebhookSignature?(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean;
  parseWebhookPayload?(headers: Record<string, string>, rawBody: string): IntegrationParsedEvent[];

  /** Only required when supportsPolling is true. */
  poll?(context: IntegrationActionContext, cursor?: string): Promise<IntegrationPollResult>;
}

export const INTEGRATION_PROVIDERS = Symbol('INTEGRATION_PROVIDERS');
