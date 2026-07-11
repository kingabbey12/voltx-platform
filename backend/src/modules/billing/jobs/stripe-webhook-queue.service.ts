import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import Stripe from 'stripe';
import { BillingEventRepository } from '../billing-event.repository';
import { StripeWebhookDispatcherService } from '../stripe/stripe-webhook-dispatcher.service';
import { STRIPE_WEBHOOK_QUEUE } from './stripe-webhook-queue.constants';

export interface StripeWebhookJobData {
  billingEventId: string;
  organizationId?: string | null;
}

/**
 * Same Redis-optional producer pattern as WorkflowRunQueueService: with
 * Redis enabled, a newly-ingested BillingEvent is enqueued and processed
 * by StripeWebhookProcessor in a worker; without Redis (dev/test), it's
 * processed inline before the controller responds — either way the
 * actual dispatch logic (processEvent) is identical and lives here so
 * there is exactly one implementation for both paths.
 */
@Injectable()
export class StripeWebhookQueueService {
  private readonly logger = new Logger(StripeWebhookQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(STRIPE_WEBHOOK_QUEUE)
    private readonly queue: Queue<StripeWebhookJobData> | null,
    private readonly billingEventRepository: BillingEventRepository,
    private readonly dispatcherService: StripeWebhookDispatcherService,
  ) {}

  async enqueue(billingEventId: string, organizationId?: string | null): Promise<void> {
    if (!this.queue) {
      await this.processEvent(billingEventId);
      return;
    }

    await this.queue.add(
      'process_event',
      { billingEventId, organizationId },
      {
        jobId: `billing-event:${billingEventId}`,
        attempts: 5,
        backoff: { type: 'exponential', delay: 3000 },
      },
    );
  }

  async processEvent(billingEventId: string): Promise<void> {
    const event = await this.billingEventRepository.findById(billingEventId);
    if (!event) {
      this.logger.warn({ billingEventId }, 'Billing event not found — cannot process');
      return;
    }

    try {
      await this.dispatcherService.dispatch(event.payload as unknown as Stripe.Event);
      await this.billingEventRepository.markProcessed(event.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.billingEventRepository.markFailed(event.id, message);
      this.logger.error({ err: error, billingEventId }, 'Failed to process Stripe webhook event');
      throw error;
    }
  }
}
