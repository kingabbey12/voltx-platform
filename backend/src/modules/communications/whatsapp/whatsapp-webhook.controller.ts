import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { ConversationService } from '../conversation/conversation.service';
import { WorkflowEventBusService } from '../../workflows/scheduling/workflow-event-bus.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Inbound WhatsApp Business Cloud API webhook. Meta hits this URL twice
 * for different purposes:
 *  - GET, once, when the webhook URL is registered in the Meta App
 *    dashboard — a verification handshake that must echo back
 *    hub.challenge if hub.verify_token matches ours.
 *  - POST, for every actual message/status event afterward — routed to
 *    the right connection via metadata.phone_number_id (which
 *    createApiKeyConnection stores as externalAccountId at connect
 *    time), the same role Slack's team_id and Teams' subscriptionId play.
 */
@ApiTags('Communications')
@Controller('communications/webhooks/whatsapp')
export class WhatsAppWebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly conversationService: ConversationService,
    private readonly workflowEventBus: WorkflowEventBusService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Meta webhook verification handshake' })
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') verifyToken: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ): void {
    const expectedToken = this.configService.get<string>(
      'integrations.providers.whatsapp.webhookVerifyToken',
      '',
    );

    if (mode === 'subscribe' && expectedToken && verifyToken === expectedToken && challenge) {
      response.status(HttpStatus.OK).type('text/plain').send(challenge);
      return;
    }
    response.status(HttpStatus.FORBIDDEN).send();
  }

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inbound WhatsApp Business Cloud API webhook' })
  async receive(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const provider = this.channelProviderRegistry.get('WHATSAPP');
    const appSecret = this.configService.get<string>(
      'integrations.providers.whatsapp.appSecret',
      '',
    );

    if (!appSecret || !provider.verifyWebhookSignature?.(headers, rawBody, appSecret)) {
      response.status(HttpStatus.UNAUTHORIZED).send({ error: 'invalid_signature' });
      return;
    }

    let body: {
      entry?: Array<{ changes?: Array<{ value?: { metadata?: { phone_number_id?: string } } }> }>;
    };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      response.status(HttpStatus.OK).send({ ok: true });
      return;
    }

    const phoneNumberId = body.entry?.[0]?.changes?.[0]?.value?.metadata?.phone_number_id;
    if (!phoneNumberId) {
      response.status(HttpStatus.OK).send({ ok: true });
      return;
    }

    const connection =
      await this.channelConnectionRepository.findByChannelAndExternalAccountIdUnscoped(
        'WHATSAPP',
        phoneNumberId,
      );

    if (connection && provider.parseInboundWebhook) {
      const credential = await this.channelConnectionService.getValidCredential(connection);
      const messages = await provider.parseInboundWebhook(headers, rawBody, {
        organizationId: connection.organizationId,
        connectionId: connection.id,
        credential,
      });
      for (const message of messages) {
        const ingested = await this.conversationService.ingestInboundMessage(
          connection.organizationId,
          connection.id,
          'WHATSAPP',
          message,
        );
        if (ingested) {
          this.workflowEventBus.emit('WHATSAPP_RECEIVED', {
            organizationId: ingested.organizationId,
            connectionId: connection.id,
            conversationId: ingested.conversationId,
            messageId: ingested.id,
            from: message.fromAddress,
            body: ingested.body,
          });
        }
      }
    }

    if (connection && provider.parseInboundStatusUpdates) {
      const statusUpdates = provider.parseInboundStatusUpdates(headers, rawBody);
      for (const update of statusUpdates) {
        await this.conversationService.ingestStatusUpdate(connection.organizationId, update);
      }
    }

    response.status(HttpStatus.OK).send({ ok: true });
  }
}
