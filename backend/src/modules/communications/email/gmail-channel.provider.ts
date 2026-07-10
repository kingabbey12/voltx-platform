import { Injectable } from '@nestjs/common';
import { GoogleGmailConnector } from '../../integrations/connectors/google/google-gmail.connector';
import { IntegrationActionContext } from '../../integrations/provider/integration-provider.types';
import {
  ChannelActionContext,
  ChannelProvider,
  CommsCredentialValue,
  OutboundMessageInput,
  OutboundMessageResult,
  ParsedInboundMessage,
} from '../channels/channel-provider.interface';

/**
 * Real Gmail channel — delegates every API call to the existing
 * GoogleGmailConnector (send_message, poll, resolveAccountIdentity) rather
 * than re-implementing the Gmail API surface. No simple webhook without a
 * separate GCP Pub/Sub setup, so inbound mail is polling-based — this
 * class only translates between the message-shaped ChannelProvider
 * contract and GoogleGmailConnector's tool-action-shaped
 * IntegrationProvider contract.
 */
@Injectable()
export class GmailChannelProvider implements ChannelProvider {
  readonly channel = 'GMAIL' as const;
  readonly displayName = 'Gmail';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly gmailConnector: GoogleGmailConnector) {
    this.oauthConfig = this.gmailConnector.oauthConfig;
  }

  async sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult> {
    const result = (await this.gmailConnector.executeAction(
      'send_message',
      { to: input.to, subject: input.subject ?? '(no subject)', body: input.body },
      toIntegrationContext(context),
    )) as { id: string };

    return { externalId: result.id, status: 'SENT' };
  }

  async poll(
    context: ChannelActionContext,
    cursor?: string,
  ): Promise<{ messages: ParsedInboundMessage[]; nextCursor?: string }> {
    if (!this.gmailConnector.poll) {
      return { messages: [] };
    }

    const result = await this.gmailConnector.poll(toIntegrationContext(context), cursor);
    const messages = result.events
      .filter((event) => event.type === 'EMAIL_RECEIVED')
      .map((event): ParsedInboundMessage => {
        const payload = event.payload as {
          id: string;
          subject: string;
          from: string;
          snippet?: string;
        };
        return {
          externalId: event.externalId ?? payload.id,
          fromAddress: payload.from,
          subject: payload.subject,
          body: payload.snippet ?? '',
          occurredAt: event.occurredAt,
        };
      });

    return { messages, nextCursor: result.nextCursor };
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    if (!this.gmailConnector.resolveAccountIdentity) {
      return Promise.resolve(undefined);
    }
    return this.gmailConnector.resolveAccountIdentity(credential);
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
