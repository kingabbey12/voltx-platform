import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from '../../security/encryption.service';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
import { microsoftOAuthConfig } from '../../provider/oauth-provider-configs';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0';

@Injectable()
export class MicrosoftTeamsConnector implements IntegrationProvider {
  readonly key = 'MICROSOFT_TEAMS' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Microsoft Teams';
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = microsoftOAuthConfig(configService, [
      'ChannelMessage.Send',
      'Team.ReadBasic.All',
    ]);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'post_message',
        description: 'Post a message to a Microsoft Teams channel.',
        inputSchema: {
          type: 'object',
          properties: {
            teamId: { type: 'string', description: 'Microsoft Teams team id.', required: true },
            channelId: {
              type: 'string',
              description: 'Channel id within the team.',
              required: true,
            },
            text: { type: 'string', description: 'Message text (HTML allowed).', required: true },
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
    if (actionName !== 'post_message') {
      throw new IntegrationProviderError(`Unknown Teams action "${actionName}"`, 'unknown_action');
    }
    return this.postMessage(input, context);
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        `${GRAPH_BASE_URL}/me/joinedTeams`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Teams health check failed',
      };
    }
  }

  /** Microsoft Graph change notifications authenticate via a shared `clientState` string echoed in every notification body, not an HMAC header — compared in constant time here. */
  verifyWebhookSignature(
    _headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    try {
      const body = JSON.parse(rawBody) as { value?: Array<{ clientState?: string }> };
      const clientState = body.value?.[0]?.clientState;
      return typeof clientState === 'string' && EncryptionService.safeEqual(clientState, secret);
    } catch {
      return false;
    }
  }

  parseWebhookPayload(_headers: Record<string, string>, rawBody: string): IntegrationParsedEvent[] {
    const body = JSON.parse(rawBody) as {
      value?: Array<{ resourceData?: { id?: string }; resource?: string }>;
    };

    return (body.value ?? []).map((notification) => ({
      type: 'TEAMS_MESSAGE' as const,
      externalId: notification.resourceData?.id,
      payload: { resource: notification.resource, resourceId: notification.resourceData?.id },
      knowledgeContribution: {
        sourceType: 'MESSAGE' as const,
        title: `Teams message notification (${notification.resource ?? 'unknown resource'})`,
        contentType: 'text',
        text: `Teams change notification for resource: ${notification.resource ?? 'unknown'}`,
        metadata: { resource: notification.resource },
      },
    }));
  }

  private async postMessage(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string }> {
    const teamId = asString(input.teamId, '');
    const channelId = asString(input.channelId, '');
    const result = await requestJson<{ id: string }>(
      `${GRAPH_BASE_URL}/teams/${teamId}/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(context), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: { contentType: 'html', content: asString(input.text, '') } }),
      },
      { signal: context.signal },
    );
    return { id: result.body.id };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}
