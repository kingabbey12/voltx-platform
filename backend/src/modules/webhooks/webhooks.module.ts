import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ToolModule } from '../ai/tools/tool.module';
import { WEBHOOK_DELIVERY_QUEUE } from './jobs/webhook-delivery-queue.constants';
import { WebhookDeliveryProcessor } from './jobs/webhook-delivery.processor';
import { WebhookDeliveryQueueService } from './jobs/webhook-delivery-queue.service';
import { WebhookDeliveryRepository } from './webhook-delivery.repository';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhookDispatchService } from './webhook-dispatch.service';
import { WebhookEndpointController } from './webhook-endpoint.controller';
import { WebhookEndpointRepository } from './webhook-endpoint.repository';
import { WebhookEndpointService } from './webhook-endpoint.service';

// Same REDIS_ENABLED-gated pattern as workflow.module.ts's run queue and
// billing's stripe-webhook queue — when Redis isn't configured,
// WebhookDeliveryQueueService falls back to driving
// WebhookDeliveryService.attemptDelivery() inline instead of enqueuing.
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: WEBHOOK_DELIVERY_QUEUE }),
    ]
  : [];
const queueProcessors = redisEnabled ? [WebhookDeliveryProcessor] : [];

/**
 * v2.3 Developer Platform (Phase 3) — outbound webhooks. Reuses
 * OutboundHttpGuardService (ToolModule) for endpoint-URL SSRF validation
 * and EncryptionService (EncryptionModule, @Global()) for at-rest secret
 * storage — no parallel implementation of either.
 */
@Module({
  imports: [ToolModule, ...queueImports],
  controllers: [WebhookEndpointController],
  providers: [
    WebhookEndpointRepository,
    WebhookEndpointService,
    WebhookDeliveryRepository,
    WebhookDeliveryService,
    WebhookDispatchService,
    WebhookDeliveryQueueService,
    ...queueProcessors,
  ],
  exports: [WebhookDispatchService],
})
export class WebhooksModule {}
