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

export interface OutboundAttachment {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
  /** A short-lived signed download URL for the same file — only Twilio MMS needs this (its MediaUrl param must be a publicly fetchable URL, not raw bytes); every other provider uploads buffer directly and ignores this. */
  signedUrl: string;
}

export interface OutboundMessageInput {
  externalThreadId?: string;
  to: string;
  subject?: string;
  body: string;
  attachments?: OutboundAttachment[];
}

export interface OutboundMessageResult {
  externalId: string;
  status: CommsMessageStatus;
}

export interface ParsedInboundAttachment {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

export interface ParsedInboundMessage {
  externalId: string;
  externalThreadId?: string;
  fromAddress: string;
  fromDisplayName?: string;
  subject?: string;
  body: string;
  occurredAt?: Date;
  attachments?: ParsedInboundAttachment[];
}

/** A delivery/read/failure status update for a message we sent, reported asynchronously by the channel (WhatsApp's `statuses` webhook array, Twilio's status callback). `externalId` matches the `externalId` an earlier OutboundMessageResult returned. */
export interface ParsedStatusUpdate {
  externalId: string;
  status: 'DELIVERED' | 'READ' | 'FAILED';
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
  /** OAUTH2 goes through ChannelConnectionService's generic authorize/exchange/refresh flow; API_KEY goes through its createApiKeyConnection flow instead (e.g. WhatsApp Cloud API access token, Twilio Account SID/Auth Token). */
  readonly authType: 'OAUTH2' | 'API_KEY';
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

  /**
   * Only required when supportsWebhooks is true (e.g. Slack Events API).
   * `requestUrl` is only used by Twilio, whose signing scheme HMACs the
   * exact webhook URL alongside the body — every other provider HMACs
   * the body alone and ignores it.
   */
  verifyWebhookSignature?(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
    requestUrl?: string,
  ): boolean;

  /**
   * Async and given the full resolved connection context (not just the
   * raw payload) so a provider whose webhook delivers only a lightweight
   * notification (Microsoft Graph change notifications for Teams) can
   * make an authenticated follow-up call to fetch the real message
   * content/attachments before returning.
   */
  parseInboundWebhook?(
    headers: Record<string, string>,
    rawBody: string,
    context: ChannelActionContext,
  ): Promise<ParsedInboundMessage[]>;

  /** Optional: extracts delivery/read/failure status updates from the same inbound webhook payload (WhatsApp's `statuses` array, Twilio's status callback params) — synchronous, no follow-up API call needed by either implementation. */
  parseInboundStatusUpdates?(
    headers: Record<string, string>,
    rawBody: string,
  ): ParsedStatusUpdate[];

  /** Optional: resolve a human-readable connected-account identifier (email, workspace name). */
  resolveAccountIdentity?(credential: CommsCredentialValue): Promise<string | undefined>;
}

export const CHANNEL_PROVIDERS = Symbol('CHANNEL_PROVIDERS');
