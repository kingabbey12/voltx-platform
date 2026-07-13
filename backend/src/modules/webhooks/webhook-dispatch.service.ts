import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WebhookDeliveryQueueService } from './jobs/webhook-delivery-queue.service';
import { WebhookDeliveryRepository } from './webhook-delivery.repository';
import { WebhookEndpointRepository } from './webhook-endpoint.repository';

/**
 * The single entry point existing domain code calls to fan an event out
 * to every subscribed webhook endpoint — see leads.service.ts,
 * workflow-engine.service.ts, and oauth-authorization.service.ts for the
 * current call sites. `organizationId` is always explicit (never read
 * from TenantContextService) because some publishers run outside any HTTP
 * request's tenant context — WorkflowEngineService's terminal-status
 * writes happen inside a BullMQ worker, where no AsyncLocalStorage-backed
 * tenant context exists at all.
 */
@Injectable()
export class WebhookDispatchService {
  private readonly logger = new Logger(WebhookDispatchService.name);

  constructor(
    private readonly endpointRepository: WebhookEndpointRepository,
    private readonly deliveryRepository: WebhookDeliveryRepository,
    private readonly queueService: WebhookDeliveryQueueService,
  ) {}

  async publish(
    eventType: string,
    organizationId: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const endpoints = await this.endpointRepository.findActiveSubscribedTo(
      organizationId,
      eventType,
    );

    for (const endpoint of endpoints) {
      const delivery = await this.deliveryRepository.create({
        endpointId: endpoint.id,
        eventType,
        payload: payload as Prisma.InputJsonValue,
      });
      await this.queueService.enqueue(delivery.id);
    }

    if (endpoints.length > 0) {
      this.logger.log(
        { eventType, organizationId, endpointCount: endpoints.length },
        'Published webhook event',
      );
    }
  }
}
