import { BadRequestException, Injectable } from '@nestjs/common';
import { MicrosoftTeamsConnector } from '../../integrations/connectors/teams/microsoft-teams.connector';
import { IntegrationActionContext } from '../../integrations/provider/integration-provider.types';
import {
  ChannelActionContext,
  ChannelProvider,
  CommsCredentialValue,
  OutboundMessageInput,
  OutboundMessageResult,
  ParsedInboundMessage,
} from '../channels/channel-provider.interface';

const RESOURCE_PATTERN = /teams\('([^']+)'\)\/channels\('([^']+)'\)\/messages\('([^']+)'\)/;

/**
 * Real Microsoft Teams channel — delegates every Graph API call to the
 * existing MicrosoftTeamsConnector. Unlike Slack (whose Events API
 * payload is self-contained) Graph change notifications for chat
 * messages are deliberately lightweight — they carry only a resource
 * reference, never the message text — so parseInboundWebhook makes an
 * authenticated follow-up call (using the credential from the resolved
 * ChannelActionContext) to fetch the real content before returning.
 *
 * A Teams "conversation" externalThreadId is the composite
 * `{teamId}/{channelId}` — there is no single Teams id that identifies a
 * channel independent of its parent team, so the pair travels together
 * everywhere a thread identifier is needed (reply target, subscription
 * resource, notification parsing).
 */
@Injectable()
export class TeamsChannelProvider implements ChannelProvider {
  readonly channel = 'TEAMS' as const;
  readonly displayName = 'Microsoft Teams';
  readonly authType = 'OAUTH2' as const;
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;
  readonly oauthConfig;

  constructor(private readonly teamsConnector: MicrosoftTeamsConnector) {
    this.oauthConfig = this.teamsConnector.oauthConfig;
  }

  async sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult> {
    const thread = input.externalThreadId ?? input.to;
    const [teamId, channelId] = (thread ?? '').split('/');
    if (!teamId || !channelId) {
      throw new BadRequestException(
        'Teams replies need a "{teamId}/{channelId}" thread — there is no way to start a new Teams conversation from the unified inbox yet, only reply to one a webhook already created.',
      );
    }

    const result = (await this.teamsConnector.executeAction(
      'post_message',
      { teamId, channelId, text: input.body },
      toIntegrationContext(context),
    )) as { id: string };

    return { externalId: result.id, status: 'SENT' };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    return this.teamsConnector.verifyWebhookSignature(headers, rawBody, secret);
  }

  async parseInboundWebhook(
    headers: Record<string, string>,
    rawBody: string,
    context: ChannelActionContext,
  ): Promise<ParsedInboundMessage[]> {
    const notifications = this.teamsConnector.parseWebhookPayload(headers, rawBody);
    const messages: ParsedInboundMessage[] = [];

    for (const notification of notifications) {
      const resource = (notification.payload as { resource?: string }).resource;
      const match = resource ? RESOURCE_PATTERN.exec(resource) : null;
      if (!match) continue;

      const [, teamId, channelId, messageId] = match;
      const message = await this.teamsConnector.getMessage(
        teamId,
        channelId,
        messageId,
        toIntegrationContext(context),
      );

      messages.push({
        externalId: message.id,
        externalThreadId: `${teamId}/${channelId}`,
        fromAddress: message.from?.user?.id ?? 'unknown',
        fromDisplayName: message.from?.user?.displayName,
        body: message.body?.content ?? '',
        occurredAt: message.createdDateTime ? new Date(message.createdDateTime) : undefined,
      });
    }

    return messages;
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    if (!this.teamsConnector.resolveAccountIdentity) {
      return Promise.resolve(undefined);
    }
    return this.teamsConnector.resolveAccountIdentity(credential);
  }
}

function toIntegrationContext(context: ChannelActionContext): IntegrationActionContext {
  return {
    organizationId: context.organizationId,
    connectionId: context.connectionId,
    credential: context.credential,
    signal: context.signal,
  };
}
