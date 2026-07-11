import { Controller, Headers, HttpCode, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request, Response } from 'express';
import Stripe from 'stripe';
import { StripeClientService } from './stripe/stripe-client.service';
import { BillingEventRepository } from './billing-event.repository';
import { StripeWebhookQueueService } from './jobs/stripe-webhook-queue.service';

interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Public — Stripe itself is the caller, not an authenticated Voltx user,
 * so this route intentionally carries no AUTH_GUARDS. Trust comes
 * entirely from `stripe.webhooks.constructEvent`'s signature check
 * against the raw request body (configure-app.ts's `verify` callback
 * stashes it as a Buffer on every request — required here since
 * Stripe's HMAC is computed over the exact bytes, not a re-serialized
 * JSON.parse/stringify round-trip). A duplicate delivery (Stripe retries
 * until it sees 200) is a no-op via BillingEventRepository.createIfNew's
 * unique-constraint-based idempotency, not reprocessed.
 */
@Controller('billing/webhooks/stripe')
export class StripeWebhookController {
  constructor(
    private readonly stripeClientService: StripeClientService,
    private readonly billingEventRepository: BillingEventRepository,
    private readonly queueService: StripeWebhookQueueService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  @ApiExcludeEndpoint()
  async receive(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RequestWithRawBody,
    @Res() response: Response,
  ): Promise<void> {
    if (!signature || !request.rawBody) {
      response.status(HttpStatus.BAD_REQUEST).send({ error: 'missing_signature' });
      return;
    }

    let event: Stripe.Event;
    try {
      event = this.stripeClientService.client.webhooks.constructEvent(
        request.rawBody,
        signature,
        this.stripeClientService.getWebhookSecretOrThrow(),
      );
    } catch {
      response.status(HttpStatus.BAD_REQUEST).send({ error: 'invalid_signature' });
      return;
    }

    // organizationId is resolved authoritatively per-event-type inside
    // StripeWebhookDispatcherService (via the Stripe customer id, which
    // lives in different places depending on object type) — not
    // pre-resolved here.
    const { event: billingEvent, isNew } = await this.billingEventRepository.createIfNew({
      stripeEventId: event.id,
      type: event.type,
      organizationId: null,
      payload: event as unknown as Record<string, unknown>,
    });

    if (isNew) {
      await this.queueService.enqueue(billingEvent.id);
    }

    response.status(HttpStatus.OK).send({ received: true });
  }
}
