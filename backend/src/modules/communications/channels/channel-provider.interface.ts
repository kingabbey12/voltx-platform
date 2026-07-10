export type CommsChannel =
  'GMAIL' | 'OUTLOOK' | 'WHATSAPP' | 'TWILIO_VOICE' | 'TWILIO_SMS' | 'SLACK' | 'TEAMS';

export type CommsMessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

/** Decrypted, ready-to-use credential handed to a channel provider for one call. */
export interface CommsCredentialValue {
  accessToken?: string;
  refreshToken?: string;
  apiKey?: string;
  tokenType?: string;
  expiresAt?: Date;
  extra?: Record<string, unknown>;
}

export interface CommsOAuthConfig {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string[];
  extraAuthorizationParams?: Record<string, string>;
}

export interface OutboundMessageInput {
  externalThreadId?: string;
  to: string;
  subject?: string;
  body: string;
}

export interface OutboundMessageResult {
  externalId: string;
  status: CommsMessageStatus;
}

export interface ParsedInboundMessage {
  externalId: string;
  externalThreadId?: string;
  fromAddress: string;
  fromDisplayName?: string;
  subject?: string;
  body: string;
  occurredAt?: Date;
}

export interface ChannelActionContext {
  organizationId: string;
  connectionId: string;
  credential: CommsCredentialValue;
  signal?: AbortSignal;
}

export class ChannelProviderError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ChannelProviderError';
  }
}

/**
 * Every messaging channel (Gmail, Slack, WhatsApp, Twilio, Teams)
 * implements this. Deliberately mirrors src/modules/integrations/provider
 * /integration-provider.types.ts's IntegrationProvider — same registry
 * pattern, same "OAuth mechanics centralized, connector only does the
 * data actions" split — but message-shaped instead of tool-action-shaped,
 * since a channel provider's job is send/receive messages, not expose
 * arbitrary named actions to the AI tool registry.
 */
export interface ChannelProvider {
  readonly channel: CommsChannel;
  readonly displayName: string;
  readonly oauthConfig?: CommsOAuthConfig;
  readonly supportsWebhooks: boolean;
  readonly supportsPolling: boolean;

  sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult>;

  /** Only required when supportsPolling is true (e.g. Gmail — no simple webhook without GCP Pub/Sub). */
  poll?(
    context: ChannelActionContext,
    cursor?: string,
  ): Promise<{
    messages: ParsedInboundMessage[];
    nextCursor?: string;
  }>;

  /** Only required when supportsWebhooks is true (e.g. Slack Events API). */
  verifyWebhookSignature?(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean;
  parseInboundWebhook?(headers: Record<string, string>, rawBody: string): ParsedInboundMessage[];

  /** Optional: resolve a human-readable connected-account identifier (email, workspace name). */
  resolveAccountIdentity?(credential: CommsCredentialValue): Promise<string | undefined>;
}

export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');
