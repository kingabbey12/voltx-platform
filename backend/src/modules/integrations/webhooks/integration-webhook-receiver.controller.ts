import { Controller, Headers, HttpCode, HttpStatus, Param, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { IntegrationWebhookReceiverService } from './integration-webhook-receiver.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

@ApiTags('Integrations')
@Controller('integrations/webhooks')
export class IntegrationWebhookReceiverController {
  constructor(
    private readonly integrationWebhookReceiverService: IntegrationWebhookReceiverService,
  ) {}

  @Post(':token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Inbound webhook delivery endpoint for a connection (no bearer auth — verified by provider signature)',
  })
  receive(
    @Param('token') token: string,
    @Headers() headers: Record<string, string>,
    @Req() request: RequestWithRawBody,
  ) {
    const rawBody = request.rawBody?.toString('utf8') ?? '';
    return this.integrationWebhookReceiverService.receive(token, headers, rawBody);
  }
}
