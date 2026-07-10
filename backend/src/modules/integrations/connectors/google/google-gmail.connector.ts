import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { IntegrationProviderError } from '../../provider/integration-provider.types';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
import { googleOAuthConfig } from '../../provider/oauth-provider-configs';
import { resolveGoogleAccountEmail } from './google-account-identity.util';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationCredentialValue,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationPollResult,
  IntegrationProvider,
} from '../../provider/integration-provider.types';

const GMAIL_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users/me';

interface GmailMessageListResponse {
  messages?: Array<{ id: string; threadId: string }>;
}

interface GmailMessageResponse {
  id: string;
  snippet?: string;
  payload?: { headers?: Array<{ name: string; value: string }> };
  internalDate?: string;
}

@Injectable()
export class GoogleGmailConnector implements IntegrationProvider {
  readonly key = 'GOOGLE_GMAIL' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Gmail';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = googleOAuthConfig(configService, [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/userinfo.email',
    ]);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'search_messages',
        description: 'Search Gmail messages using Gmail query syntax.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Gmail search query, e.g. "from:boss@company.com".',
              required: true,
            },
            maxResults: { type: 'number', description: 'Max messages to return, default 10.' },
          },
        },
      },
      {
        name: 'read_message',
        description: 'Read the content of a single Gmail message by id.',
        inputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'string', description: 'Gmail message id.', required: true },
          },
        },
      },
      {
        name: 'send_message',
        description: 'Send an email via Gmail.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address.', required: true },
            subject: { type: 'string', description: 'Email subject.', required: true },
            body: { type: 'string', description: 'Plain-text email body.', required: true },
            attachments: {
              type: 'array',
              description: 'Optional file attachments, base64-encoded.',
            },
          },
        },
      },
    ];
  }

  async executeAction(
    actionName: string,
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<unknown> {
    switch (actionName) {
      case 'search_messages':
        return this.searchMessages(input, context);
      case 'read_message':
        return this.readMessage(input, context);
      case 'send_message':
        return this.sendMessage(input, context);
      default:
        throw new IntegrationProviderError(
          `Unknown Gmail action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  resolveAccountIdentity(credential: IntegrationCredentialValue): Promise<string | undefined> {
    return resolveGoogleAccountEmail(credential);
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        `${GMAIL_BASE_URL}/profile`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Gmail health check failed',
      };
    }
  }

  async poll(context: IntegrationActionContext, cursor?: string): Promise<IntegrationPollResult> {
    const query = cursor ? `after:${cursor}` : 'newer_than:1d';
    const list = await requestJson<GmailMessageListResponse>(
      `${GMAIL_BASE_URL}/messages?q=${encodeURIComponent(query)}&maxResults=20`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );

    const events: IntegrationParsedEvent[] = [];
    for (const item of list.body.messages ?? []) {
      const message = await requestJson<GmailMessageResponse>(
        `${GMAIL_BASE_URL}/messages/${item.id}`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      events.push(toEmailEvent(message.body));
    }

    return { events, nextCursor: String(Math.floor(Date.now() / 1000)) };
  }

  private async searchMessages(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ messages: Array<{ id: string; snippet?: string; subject?: string }> }> {
    const query = asString(input.query, '');
    const maxResults = Number(input.maxResults ?? 10);
    const list = await requestJson<GmailMessageListResponse>(
      `${GMAIL_BASE_URL}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );

    const messages = await Promise.all(
      (list.body.messages ?? []).map(async (item) => {
        const message = await requestJson<GmailMessageResponse>(
          `${GMAIL_BASE_URL}/messages/${item.id}`,
          { headers: this.authHeaders(context) },
          { signal: context.signal },
        );
        return {
          id: message.body.id,
          snippet: message.body.snippet,
          subject: headerValue(message.body, 'Subject'),
        };
      }),
    );

    return { messages };
  }

  private async readMessage(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; subject?: string; from?: string; snippet?: string }> {
    const messageId = asString(input.messageId, '');
    const message = await requestJson<GmailMessageResponse>(
      `${GMAIL_BASE_URL}/messages/${messageId}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      id: message.body.id,
      subject: headerValue(message.body, 'Subject'),
      from: headerValue(message.body, 'From'),
      snippet: message.body.snippet,
    };
  }

  private async sendMessage(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string }> {
    const to = asString(input.to, '');
    const subject = asString(input.subject, '');
    const body = asString(input.body, '');
    const attachments = Array.isArray(input.attachments)
      ? (input.attachments as GmailOutboundAttachment[])
      : [];
    const raw = base64UrlEncode(buildRfc822Message(to, subject, body, attachments));

    const result = await requestJson<{ id: string }>(
      `${GMAIL_BASE_URL}/messages/send`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(context), 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw }),
      },
      { signal: context.signal },
    );
    return { id: result.body.id };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}

function headerValue(message: GmailMessageResponse, name: string): string | undefined {
  return message.payload?.headers?.find(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  )?.value;
}

function toEmailEvent(message: GmailMessageResponse): IntegrationParsedEvent {
  const subject = headerValue(message, 'Subject') ?? '(no subject)';
  const from = headerValue(message, 'From') ?? 'unknown sender';
  return {
    type: 'EMAIL_RECEIVED',
    externalId: message.id,
    occurredAt: message.internalDate ? new Date(Number(message.internalDate)) : undefined,
    payload: { id: message.id, subject, from, snippet: message.snippet },
    knowledgeContribution: {
      sourceType: 'EMAIL',
      title: subject,
      contentType: 'text',
      text: `From: ${from}\nSubject: ${subject}\n\n${message.snippet ?? ''}`,
      metadata: { from, subject, gmailMessageId: message.id },
    },
  };
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
}

export interface GmailOutboundAttachment {
  filename: string;
  mimeType: string;
  contentBase64: string;
}

/**
 * Builds a raw RFC 822 message for the Gmail API's messages.send `raw`
 * field. Plain text/HTML-only messages stay a single text/plain part
 * (unchanged from before attachments existed); attaching one or more
 * files switches to a multipart/mixed body, one part per attachment,
 * each base64-encoded — the only encoding multipart/mixed permits for
 * arbitrary binary content.
 */
function buildRfc822Message(
  to: string,
  subject: string,
  body: string,
  attachments: GmailOutboundAttachment[],
): string {
  if (attachments.length === 0) {
    return `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${body}`;
  }

  const boundary = `voltx_${randomUUID()}`;
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ];

  for (const attachment of attachments) {
    lines.push(
      `--${boundary}`,
      `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"`,
      'Content-Transfer-Encoding: base64',
      `Content-Disposition: attachment; filename="${attachment.filename}"`,
      '',
      attachment.contentBase64,
    );
  }

  lines.push(`--${boundary}--`);
  return lines.join('\r\n');
}
