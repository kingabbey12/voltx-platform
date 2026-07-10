import { Controller, Headers, HttpCode, HttpStatus, Post, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ChannelConnectionRepository } from '../channel-connections/channel-connection.repository';
import { ChannelConnectionService } from '../channel-connections/channel-connection.service';
import { ChannelProviderRegistry } from '../channels/channel-provider.registry';
import { ConversationService } from '../conversation/conversation.service';
import { TeamsSubscriptionService } from './teams-subscription.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Inbound Microsoft Graph change-notification webhook for Teams channel
 * messages. Two request shapes hit this same URL:
 *  1. Graph's subscription-creation validation handshake — a
 *     `validationToken` query param that must be echoed back as plain
 *     text within 10 seconds, no signature/body to check yet.
 *  2. Real notifications — a JSON body whose per-item `subscriptionId`
 *     resolves back to the connection (the same role Slack's team_id
 *     plays), then clientState-based signature verification before
 *     ingesting anything.
 */
@ApiTags('Communications')
@Controller('communications/webhooks/teams')
export class TeamsWebhookController {
  constructor(
    private readonly channelProviderRegistry: ChannelProviderRegistry,
    private readonly channelConnectionRepository: ChannelConnectionRepository,
    private readonly channelConnectionService: ChannelConnectionService,
    private readonly teamsSubscriptionService: TeamsSubscriptionService,
    private readonly conversationService: ConversationService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Inbound Microsoft Graph change notification for Teams channel messages',
  })
  async receive(
    @Headers() headers: Record<string, string>,
    @Query('validationToken') validationToken: string | undefined,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    if (validationToken) {
      response.status(HttpStatus.OK).type('text/plain').send(validationToken);
      return;
    }

    const rawBody = request.rawBody?.toString('utf8') ?? '';
    let body: { value?: Array<{ subscriptionId?: string }> };
    try {
      body = JSON.parse(rawBody) as typeof body;
    } catch {
      response.status(HttpStatus.OK).send({ ok: true });
      return;
    }

    const subscriptionId = body.value?.[0]?.subscriptionId;
    if (!subscriptionId) {
      response.status(HttpStatus.OK).send({ ok: true });
      return;
    }

    const connection =
      await this.channelConnectionRepository.findByTeamsSubscriptionIdUnscoped(subscriptionId);
    if (!connection) {
      response.status(HttpStatus.OK).send({ ok: true });
      return;
    }

    const provider = this.channelProviderRegistry.get('TEAMS');
    const clientState = await this.teamsSubscriptionService.getClientState(connection.id);
    if (!clientState || !provider.verifyWebhookSignature?.(headers, rawBody, clientState)) {
      response.status(HttpStatus.UNAUTHORIZED).send({ error: 'invalid_signature' });
      return;
    }

    if (provider.parseInboundWebhook) {
      const credential = await this.channelConnectionService.getValidCredential(connection);
      const messages = await provider.parseInboundWebhook(headers, rawBody, {
        organizationId: connection.organizationId,
        connectionId: connection.id,
        credential,
      });
      for (const message of messages) {
        await this.conversationService.ingestInboundMessage(
          connection.organizationId,
          connection.id,
          'TEAMS',
          message,
        );
      }
    }

    response.status(HttpStatus.OK).send({ ok: true });
  }
}
