import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WebhookDeliveryService } from '../webhook-delivery.service';
import { WEBHOOK_DELIVERY_QUEUE } from './webhook-delivery-queue.constants';
import { WebhookDeliveryJobData } from './webhook-delivery-queue.service';

/**
 * Drains the same WebhookDeliveryService.attemptDelivery() the
 * Redis-disabled inline fallback uses. Throwing lets BullMQ retry per the
 * queue's configured backoff; on the final allowed attempt,
 * attemptDelivery() itself marks the delivery EXHAUSTED and this resolves
 * normally instead of throwing — exhaustion is an expected, self-managed
 * terminal state, not a BullMQ-level job failure, so it deliberately never
 * reaches DeadLetterListenerService.
 */
@Processor(WEBHOOK_DELIVERY_QUEUE)
export class WebhookDeliveryProcessor extends WorkerHost {
  constructor(private readonly webhookDeliveryService: WebhookDeliveryService) {
    super();
  }

  async process(job: Job<WebhookDeliveryJobData>): Promise<void> {
    const maxAttempts = job.opts.attempts ?? 1;
    const attemptNumber = job.attemptsMade + 1;

    const succeeded = await this.webhookDeliveryService.attemptDelivery(
      job.data.deliveryId,
      attemptNumber,
      maxAttempts,
    );

    if (!succeeded && attemptNumber < maxAttempts) {
      throw new Error(
        `Webhook delivery ${job.data.deliveryId} attempt ${attemptNumber} failed — retrying`,
      );
    }
  }
}
