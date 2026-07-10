import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { ConversationService } from '../conversation/conversation.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Slack delivers every connected workspace's events to this one
 * app-level Request URL (unlike the per-connection token URLs the
 * generic integrations webhook receiver uses) — inbound payloads
 * self-identify their workspace via team_id, which
 * ChannelConnectionRepository.findByChannelAndExternalAccountIdUnscoped
 * resolves to a connection/organization. No bearer auth — verified by
 * Slack's HMAC request signature instead, same trust model as the
 * existing integrations webhook receiver.
 */
@ApiTags('Communications')
@Controller('communications/webhooks/slack')
export class SlackWebhookController {
  constructor(
    private readonly configService: ConfigService,
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly conversationService: ConversationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inbound Slack Events API webhook' })
  async receive(
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    const provider = this.channelProviderRegistry.get('SLACK');
    const signingSecret = this.configService.get<string>(
      'integrations.providers.slack.signingSecret',
      '',
    );

    if (!signingSecret || !provider.verifyWebhookSignature?.(headers, rawBody, signingSecret)) {
      response.status(HttpStatus.UNAUTHORIZED).send({ error: 'invalid_signature' });
      return;
    }

    const body = JSON.parse(rawBody) as { type?: string; challenge?: string; team_id?: string };

    // Slack's one-time endpoint verification handshake.
    if (body.type === 'url_verification') {
      response.status(HttpStatus.OK).send({ challenge: body.challenge });
      return;
    }

    if (!body.team_id) {
      response.status(HttpStatus.OK).send({ ok: true });
      return;
    }

    const connection =
      await this.channelConnectionRepository.findByChannelAndExternalAccountIdUnscoped(
        'SLACK',
        body.team_id,
      );

    if (connection && provider.parseInboundWebhook) {
      const messages = provider.parseInboundWebhook(headers, rawBody);
      for (const message of messages) {
        await this.conversationService.ingestInboundMessage(
          connection.organizationId,
          connection.id,
          'SLACK',
          message,
        );
      }
    }

    response.status(HttpStatus.OK).send({ ok: true });
  }
}
