import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeClientService } from '../billing/stripe/stripe-client.service';
import { MarketplaceStripeWebhookDispatcherService } from './marketplace-stripe-webhook-dispatcher.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Its own endpoint/signing secret, registered separately in the Stripe
 * dashboard from Billing's `/billing/webhooks/stripe` — same Stripe
 * account and API key (via StripeClientService), distinct webhook secret
 * (`marketplace.stripeWebhookSecret`), so Marketplace never depends on
 * Billing's webhook dispatcher. Public — Stripe is the caller, trust
 * comes entirely from the signature check, exactly like
 * StripeWebhookController. Processing here is synchronous DB writes only
 * (no outbound calls), so unlike Billing's BullMQ-queued dispatch, a
 * queue would add nothing — Stripe's own webhook retry (on non-2xx)
 * already covers transient failures, and both handlers are idempotent.
 */
@Controller('marketplace/webhooks/stripe')
export class MarketplaceStripeWebhookController {
  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly dispatcher: MarketplaceStripeWebhookDispatcherService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receive(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    const webhookSecret = this.configService.get<string>('marketplace.stripeWebhookSecret', '');
    if (!signature || !request.rawBody || !webhookSecret) {
      response.status(HttpStatus.BAD_REQUEST).send({ error: 'missing_signature' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripeClientService.client.webhooks.constructEvent(
        request.rawBody,
        signature,
        webhookSecret,
      );
    } catch {
      response.status(HttpStatus.BAD_REQUEST).send({ error: 'invalid_signature' });
      return;
    }

    await this.dispatcher.dispatch(event);

    response.status(HttpStatus.OK).send({ received: true });
  }
}
