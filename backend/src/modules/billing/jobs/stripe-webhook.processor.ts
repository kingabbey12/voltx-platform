import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DeadLetterListenerService } from '../../background-jobs/dead-letter-listener.service';
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
  constructor(
    private readonly queueService: StripeWebhookQueueService,
    private readonly deadLetters: DeadLetterListenerService,
  ) {
    super();
  }

  async process(job: Job<StripeWebhookJobData>): Promise<void> {
    await this.queueService.processEvent(job.data.billingEventId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<StripeWebhookJobData> | undefined, error: Error): Promise<void> {
    await this.deadLetters.recordFailedJob(STRIPE_WEBHOOK_QUEUE, job, error);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.deadLetters.logWorkerRedisError(STRIPE_WEBHOOK_QUEUE, error);
  }
}
