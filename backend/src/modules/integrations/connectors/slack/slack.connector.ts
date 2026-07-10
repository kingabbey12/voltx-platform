import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { EncryptionService } from '../../security/encryption.service';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
import { slackOAuthConfig } from '../../provider/oauth-provider-configs';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationCredentialValue,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const SLACK_API_BASE_URL = 'https://slack.com/api';
const SIGNATURE_MAX_AGE_SECONDS = 5 * 60;

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  [key: string]: unknown;
}

interface SlackAuthTestResponse extends SlackApiResponse {
  team_id?: string;
  team?: string;
}

@Injectable()
export class SlackConnector implements IntegrationProvider {
  readonly key = 'SLACK' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Slack';
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = slackOAuthConfig(configService, [
      'chat:write',
      'channels:read',
      'channels:history',
    ]);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'post_message',
        description: 'Post a message to a Slack channel.',
        inputSchema: {
          type: 'object',
          properties: {
            channel: {
              type: 'string',
              description: 'Slack channel id or name, e.g. #general.',
              required: true,
            },
            text: { type: 'string', description: 'Message text.', required: true },
          },
        },
      },
      {
        name: 'list_channels',
        description: 'List Slack channels the connection can see.',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  async executeAction(
    actionName: string,
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<unknown> {
    switch (actionName) {
      case 'post_message':
        return this.postMessage(input, context);
      case 'list_channels':
        return this.listChannels(context);
      default:
        throw new IntegrationProviderError(
          `Unknown Slack action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      const result = await requestJson<SlackApiResponse>(
        `${SLACK_API_BASE_URL}/auth.test`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      if (!result.body.ok) {
        return { healthy: false, latencyMs: Date.now() - startedAt, message: result.body.error };
      }
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Slack health check failed',
      };
    }
  }

  /**
   * Returns the workspace's team_id — used both as a display identifier
   * ("connected as Acme Corp") and, for the Communications platform's
   * inbound webhook routing, to resolve which connection a Slack Events
   * API payload belongs to (Slack delivers all workspaces' events to one
   * app-level Request URL; team_id is the only thing that tells you which
   * installation it's for).
   */
  async resolveAccountIdentity(
    credential: IntegrationCredentialValue,
  ): Promise<string | undefined> {
    if (!credential.accessToken) return undefined;
    try {
      const result = await requestJson<SlackAuthTestResponse>(`${SLACK_API_BASE_URL}/auth.test`, {
        headers: { Authorization: `Bearer ${credential.accessToken}` },
      });
      return result.body.ok ? result.body.team_id : undefined;
    } catch {
      return undefined;
    }
  }

  /** Slack's signing scheme: HMAC-SHA256 over `v0:{timestamp}:{rawBody}`, compared in constant time, and rejected outside a 5-minute window to block replay. */
  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    const timestamp = headers['x-slack-request-timestamp'];
    const signature = headers['x-slack-signature'];
    if (!timestamp || !signature) {
      return false;
    }

    const age = Math.abs(Date.now() / 1000 - Number(timestamp));
    if (!Number.isFinite(age) || age > SIGNATURE_MAX_AGE_SECONDS) {
      return false;
    }

    const basestring = `v0:${timestamp}:${rawBody}`;
    const expected = `v0=${createHmac('sha256', secret).update(basestring).digest('hex')}`;
    return EncryptionService.safeEqual(expected, signature);
  }

  parseWebhookPayload(_headers: Record<string, string>, rawBody: string): IntegrationParsedEvent[] {
    const body = JSON.parse(rawBody) as {
      type?: string;
      challenge?: string;
      event?: { type?: string; user?: string; text?: string; channel?: string; ts?: string };
    };

    if (body.type === 'url_verification' || !body.event || body.event.type !== 'message') {
      return [];
    }

    const event = body.event;
    const text = event.text ?? '';
    return [
      {
        type: 'SLACK_MESSAGE',
        externalId: event.ts,
        payload: { channel: event.channel, user: event.user, text },
        knowledgeContribution: {
          sourceType: 'MESSAGE',
          title: `Slack message in ${event.channel ?? 'unknown channel'}`,
          contentType: 'text',
          text,
          metadata: { channel: event.channel, user: event.user },
        },
      },
    ];
  }

  private async postMessage(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ ts: string; channel: string }> {
    const result = await requestJson<SlackApiResponse & { ts?: string; channel?: string }>(
      `${SLACK_API_BASE_URL}/chat.postMessage`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(context),
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: asString(input.channel, ''),
          text: asString(input.text, ''),
        }),
      },
      { signal: context.signal },
    );

    if (!result.body.ok) {
      throw new IntegrationProviderError(
        `Slack post_message failed: ${result.body.error}`,
        'slack_api_error',
      );
    }

    return { ts: String(result.body.ts), channel: String(result.body.channel) };
  }

  private async listChannels(
    context: IntegrationActionContext,
  ): Promise<{ channels: Array<{ id: string; name: string }> }> {
    const result = await requestJson<
      SlackApiResponse & { channels?: Array<{ id: string; name: string }> }
    >(
      `${SLACK_API_BASE_URL}/conversations.list`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );

    if (!result.body.ok) {
      throw new IntegrationProviderError(
        `Slack list_channels failed: ${result.body.error}`,
        'slack_api_error',
      );
    }

    return { channels: result.body.channels ?? [] };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}
