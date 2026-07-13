import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { WebhookDeliveryService } from '../webhook-delivery.service';
import { WEBHOOK_DELIVERY_QUEUE } from './webhook-delivery-queue.constants';

export interface WebhookDeliveryJobData {
  deliveryId: string;
}

/**
 * Same Redis-optional shape as WorkflowRunQueueService/
 * stripe-webhook-queue.service.ts: when Redis is disabled, drives
 * WebhookDeliveryService.attemptDelivery() inline exactly once (dev/test
 * are unaffected); otherwise enqueues with a deterministic jobId and lets
 * BullMQ's own attempts/backoff manage retries. A job that keeps failing
 * is retried up to `webhooks.maxDeliveryAttempts` times before
 * WebhookDeliveryService marks the row EXHAUSTED on the final attempt —
 * see WebhookDeliveryProcessor for how that's distinguished from a real
 * BullMQ job failure.
 */
@Injectable()
export class WebhookDeliveryQueueService {
  private readonly logger = new Logger(WebhookDeliveryQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(WEBHOOK_DELIVERY_QUEUE)
    private readonly queue: Queue<WebhookDeliveryJobData> | null,
    private readonly webhookDeliveryService: WebhookDeliveryService,
    private readonly configService: ConfigService,
  ) {}

  async enqueue(deliveryId: string): Promise<void> {
    if (!this.queue) {
      await this.webhookDeliveryService.attemptDelivery(deliveryId, 1, 1);
      return;
    }

    const maxAttempts = this.configService.get<number>('webhooks.maxDeliveryAttempts', 6);
    const retryBaseDelayMs = this.configService.get<number>('webhooks.retryBaseDelayMs', 5000);

    await this.queue.add(
      'deliver',
      { deliveryId },
      {
        jobId: `webhook-delivery:${deliveryId}`,
        attempts: maxAttempts,
        backoff: { type: 'exponential', delay: retryBaseDelayMs },
      },
    );
    this.logger.log({ deliveryId }, 'Enqueued webhook delivery');
  }
}
