import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { STRIPE_WEBHOOK_QUEUE } from './stripe-webhook-queue.constants';
import { StripeWebhookJobData, StripeWebhookQueueService } from './stripe-webhook-queue.service';

/**
 * Drains StripeWebhookQueueService.processEvent — a job that throws is
 * retried per the queue's configured backoff; once attempts are
 * exhausted, DeadLetterListenerService records it in
 * BackgroundJobFailure, same as every other monitored queue.
 */
@Processor(STRIPE_WEBHOOK_QUEUE)
export class StripeWebhookProcessor extends WorkerHost {
  constructor(private readonly queueService: StripeWebhookQueueService) {
    super();
  }

  async process(job: Job<StripeWebhookJobData>): Promise<void> {
    await this.queueService.processEvent(job.data.billingEventId);
  }
}
