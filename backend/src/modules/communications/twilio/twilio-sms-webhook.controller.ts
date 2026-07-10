import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { ConversationService } from '../conversation/conversation.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Inbound Twilio SMS/MMS webhook. Twilio POSTs form-encoded (not JSON,
 * unlike every other channel's webhook here) and routes to the right
 * connection via the `To` field — the Twilio number that received the
 * message, stored as externalAccountId at connect time, the same role
 * Slack's team_id and WhatsApp's phone_number_id play. Signature
 * verification needs that connection's own Auth Token (not a global
 * secret), so connection resolution has to happen before verification,
 * same ordering as Slack/WhatsApp.
 *
 * Status callbacks for a message *we* sent carry the same To/From as the
 * original send — meaning our own Twilio number is in `From`, not `To` —
 * so connection lookup falls back to `From` when `To` doesn't match one of
 * our connections, or a delivery/read receipt for our own outbound
 * messages would never resolve to a connection at all.
 */
@ApiTags('Communications')
@Controller('communications/webhooks/twilio/sms')
export class TwilioSmsWebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly conversationService: ConversationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inbound Twilio SMS/MMS webhook' })
  async receive(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const params = new URLSearchParams(rawBody);
    const to = params.get('To');
    const from = params.get('From');

    const connection = await this.resolveConnection(to, from);
    if (!connection) {
      response.status(HttpStatus.OK).type('text/xml').send('<Response></Response>');
      return;
    }

    const provider = this.channelProviderRegistry.get('TWILIO_SMS');
    const credential = await this.channelConnectionService.getValidCredential(connection);
    const webhookBaseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');
    const requestUrl = `${webhookBaseUrl}/api/v1/communications/webhooks/twilio/sms`;

    if (!provider.verifyWebhookSignature?.(headers, rawBody, credential.apiKey ?? '', requestUrl)) {
      response.status(HttpStatus.UNAUTHORIZED).send({ error: 'invalid_signature' });
      return;
    }

    if (provider.parseInboundWebhook) {
      const messages = await provider.parseInboundWebhook(headers, rawBody, {
        organizationId: connection.organizationId,
        connectionId: connection.id,
        credential,
      });
      for (const message of messages) {
        await this.conversationService.ingestInboundMessage(
          connection.organizationId,
          connection.id,
          'TWILIO_SMS',
          message,
        );
      }
    }

    if (provider.parseInboundStatusUpdates) {
      const statusUpdates = provider.parseInboundStatusUpdates(headers, rawBody);
      for (const update of statusUpdates) {
        await this.conversationService.ingestStatusUpdate(connection.organizationId, update);
      }
    }

    response.status(HttpStatus.OK).type('text/xml').send('<Response></Response>');
  }

  private async resolveConnection(to: string | null, from: string | null) {
    if (to) {
      const byTo = await this.channelConnectionRepository.findByChannelAndExternalAccountIdUnscoped(
        'TWILIO_SMS',
        to,
      );
      if (byTo) return byTo;
    }
    if (from) {
      return this.channelConnectionRepository.findByChannelAndExternalAccountIdUnscoped(
        'TWILIO_SMS',
        from,
      );
    }
    return null;
  }
}
