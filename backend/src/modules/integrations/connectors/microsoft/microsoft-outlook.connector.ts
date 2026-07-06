import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
import { microsoftOAuthConfig } from '../../provider/oauth-provider-configs';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationPollResult,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0/me';

interface OutlookMessage {
  id: string;
  subject?: string;
  bodyPreview?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
}

interface OutlookMessageListResponse {
  value?: OutlookMessage[];
}

@Injectable()
export class MicrosoftOutlookConnector implements IntegrationProvider {
  readonly key = 'MICROSOFT_OUTLOOK' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Outlook';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = microsoftOAuthConfig(configService, ['Mail.Read', 'Mail.Send']);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'search_messages',
        description: 'Search Outlook messages.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search text.', required: true },
            maxResults: { type: 'number', description: 'Max messages to return, default 10.' },
          },
        },
      },
      {
        name: 'read_message',
        description: 'Read a single Outlook message by id.',
        inputSchema: {
          type: 'object',
          properties: {
            messageId: { type: 'string', description: 'Outlook message id.', required: true },
          },
        },
      },
      {
        name: 'send_message',
        description: 'Send an email via Outlook.',
        inputSchema: {
          type: 'object',
          properties: {
            to: { type: 'string', description: 'Recipient email address.', required: true },
            subject: { type: 'string', description: 'Email subject.', required: true },
            body: { type: 'string', description: 'Plain-text email body.', required: true },
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
          `Unknown Outlook action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        GRAPH_BASE_URL,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Outlook health check failed',
      };
    }
  }

  async poll(context: IntegrationActionContext, cursor?: string): Promise<IntegrationPollResult> {
    const since = cursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const list = await requestJson<OutlookMessageListResponse>(
      `${GRAPH_BASE_URL}/messages?$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}&$orderby=receivedDateTime desc`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      events: (list.body.value ?? []).map(toEmailEvent),
      nextCursor: new Date().toISOString(),
    };
  }

  private async searchMessages(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ messages: Array<{ id: string; subject?: string; preview?: string }> }> {
    const query = asString(input.query, '');
    const maxResults = Number(input.maxResults ?? 10);
    const list = await requestJson<OutlookMessageListResponse>(
      `${GRAPH_BASE_URL}/messages?$search=${encodeURIComponent(`"${query}"`)}&$top=${maxResults}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      messages: (list.body.value ?? []).map((message) => ({
        id: message.id,
        subject: message.subject,
        preview: message.bodyPreview,
      })),
    };
  }

  private async readMessage(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; subject?: string; from?: string; preview?: string }> {
    const messageId = asString(input.messageId, '');
    const message = await requestJson<OutlookMessage>(
      `${GRAPH_BASE_URL}/messages/${messageId}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      id: message.body.id,
      subject: message.body.subject,
      from: message.body.from?.emailAddress?.address,
      preview: message.body.bodyPreview,
    };
  }

  private async sendMessage(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ sent: boolean }> {
    await requestJson(
      `${GRAPH_BASE_URL}/sendMail`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(context), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            subject: asString(input.subject, ''),
            body: { contentType: 'Text', content: asString(input.body, '') },
            toRecipients: [{ emailAddress: { address: asString(input.to, '') } }],
          },
        }),
      },
      { signal: context.signal },
    );
    return { sent: true };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}

function toEmailEvent(message: OutlookMessage): IntegrationParsedEvent {
  const subject = message.subject ?? '(no subject)';
  const from = message.from?.emailAddress?.address ?? 'unknown sender';
  return {
    type: 'EMAIL_RECEIVED',
    externalId: message.id,
    occurredAt: message.receivedDateTime ? new Date(message.receivedDateTime) : undefined,
    payload: { id: message.id, subject, from, preview: message.bodyPreview },
    knowledgeContribution: {
      sourceType: 'EMAIL',
      title: subject,
      contentType: 'text',
      text: `From: ${from}\nSubject: ${subject}\n\n${message.bodyPreview ?? ''}`,
      metadata: { from, subject, outlookMessageId: message.id },
    },
  };
}
