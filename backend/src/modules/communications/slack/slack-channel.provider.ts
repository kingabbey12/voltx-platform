import { Injectable } from '@nestjs/common';
import { SlackConnector } from '../../integrations/connectors/slack/slack.connector';
import { IntegrationActionContext } from '../../integrations/provider/integration-provider.types';
import {
  ChannelActionContext,
  ChannelProvider,
  ChannelProviderError,
  CommsCredentialValue,
  OutboundMessageInput,
  OutboundMessageResult,
  ParsedInboundMessage,
} from '../channels/channel-provider.interface';

/**
 * Real Slack channel — delegates every API call to the existing
 * SlackConnector (post_message, verifyWebhookSignature, parseWebhookPayload)
 * rather than re-implementing the Slack API surface. This class only
 * translates between the message-shaped ChannelProvider contract and
 * SlackConnector's tool-action-shaped IntegrationProvider contract; zero
 * duplicated HTTP-calling logic.
 */
@Injectable()
export class SlackChannelProvider implements ChannelProvider {
  readonly channel = 'SLACK' as const;
  readonly displayName = 'Slack';
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;
  readonly oauthConfig;

  constructor(private readonly slackConnector: SlackConnector) {
    this.oauthConfig = this.slackConnector.oauthConfig;
  }

  async sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult> {
    const result = (await this.slackConnector.executeAction(
      'post_message',
      { channel: input.to || input.externalThreadId, text: input.body },
      toIntegrationContext(context),
    )) as { ts: string; channel: string };

    return { externalId: result.ts, status: 'SENT' };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    if (!this.slackConnector.verifyWebhookSignature) {
      throw new ChannelProviderError(
        'Slack connector has no signature verification',
        'not_supported',
      );
    }
    return this.slackConnector.verifyWebhookSignature(headers, rawBody, secret);
  }

  parseInboundWebhook(headers: Record<string, string>, rawBody: string): ParsedInboundMessage[] {
    if (!this.slackConnector.parseWebhookPayload) {
      return [];
    }

    const events = this.slackConnector.parseWebhookPayload(headers, rawBody);
    return events
      .filter((event) => event.type === 'SLACK_MESSAGE')
      .map((event) => {
        const payload = event.payload as { channel?: string; user?: string; text?: string };
        return {
          externalId: event.externalId ?? '',
          externalThreadId: payload.channel,
          fromAddress: payload.user ?? 'unknown',
          body: payload.text ?? '',
          occurredAt: event.occurredAt,
        };
      });
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    return this.slackConnector.resolveAccountIdentity(credential);
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
