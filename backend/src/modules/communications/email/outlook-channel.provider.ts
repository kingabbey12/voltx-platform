import { Injectable } from '@nestjs/common';
import { MicrosoftOutlookConnector } from '../../integrations/connectors/microsoft/microsoft-outlook.connector';
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
 * Real Outlook channel — delegates every API call to the existing
 * MicrosoftOutlookConnector (search/read/send via Microsoft Graph) rather
 * than re-implementing the Graph API surface. Mirrors GmailChannelProvider
 * exactly: polling-based inbound (no simple webhook without a Graph
 * subscription + a public HTTPS endpoint), this class only translates
 * between the message-shaped ChannelProvider contract and
 * MicrosoftOutlookConnector's tool-action-shaped IntegrationProvider
 * contract.
 */
@Injectable()
export class OutlookChannelProvider implements ChannelProvider {
  readonly channel = 'OUTLOOK' as const;
  readonly displayName = 'Outlook';
  readonly authType = 'OAUTH2' as const;
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly outlookConnector: MicrosoftOutlookConnector) {
    this.oauthConfig = this.outlookConnector.oauthConfig;
  }

  async sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult> {
    await this.outlookConnector.executeAction(
      'send_message',
      {
        to: input.to,
        subject: input.subject ?? '(no subject)',
        body: input.body,
        attachments: input.attachments?.map((attachment) => ({
          filename: attachment.fileName,
          mimeType: attachment.mimeType,
          contentBase64: attachment.buffer.toString('base64'),
        })),
      },
      toIntegrationContext(context),
    );

    // Graph's sendMail returns no body (202 Accepted, fire-and-forget) —
    // unlike Gmail/Slack there is no id to correlate a later delivery
    // receipt against, so externalId is synthesized from the send time.
    return { externalId: `outlook-${Date.now()}`, status: 'SENT' };
  }

  async poll(
    context: ChannelActionContext,
    cursor?: string,
  ): Promise<{ messages: ParsedInboundMessage[]; nextCursor?: string }> {
    if (!this.outlookConnector.poll) {
      return { messages: [] };
    }

    const result = await this.outlookConnector.poll(toIntegrationContext(context), cursor);
    const messages = result.events
      .filter((event) => event.type === 'EMAIL_RECEIVED')
      .map((event): ParsedInboundMessage => {
        const payload = event.payload as {
          id: string;
          subject: string;
          from: string;
          preview?: string;
        };
        return {
          externalId: event.externalId ?? payload.id,
          fromAddress: payload.from,
          subject: payload.subject,
          body: payload.preview ?? '',
          occurredAt: event.occurredAt,
        };
      });

    return { messages, nextCursor: result.nextCursor };
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    if (!this.outlookConnector.resolveAccountIdentity) {
      return Promise.resolve(undefined);
    }
    return this.outlookConnector.resolveAccountIdentity(credential);
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
