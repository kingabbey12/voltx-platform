import { Test, TestingModule } from '@nestjs/testing';
import { WebhookEndpointStatus } from '@prisma/client';
import { WebhookDeliveryQueueService } from '../src/modules/webhooks/jobs/webhook-delivery-queue.service';
import { WebhookDeliveryRepository } from '../src/modules/webhooks/webhook-delivery.repository';
import { WebhookDispatchService } from '../src/modules/webhooks/webhook-dispatch.service';
import { WebhookEndpointRepository } from '../src/modules/webhooks/webhook-endpoint.repository';

describe('WebhookDispatchService', () => {
  let service: WebhookDispatchService;
  let endpointRepository: jest.Mocked<WebhookEndpointRepository>;
  let deliveryRepository: jest.Mocked<WebhookDeliveryRepository>;
  let queueService: jest.Mocked<WebhookDeliveryQueueService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDispatchService,
        { provide: WebhookEndpointRepository, useValue: { findActiveSubscribedTo: jest.fn() } },
        { provide: WebhookDeliveryRepository, useValue: { create: jest.fn() } },
        { provide: WebhookDeliveryQueueService, useValue: { enqueue: jest.fn() } },
      ],
    }).compile();

    service = module.get(WebhookDispatchService);
    endpointRepository = module.get(WebhookEndpointRepository);
    deliveryRepository = module.get(WebhookDeliveryRepository);
    queueService = module.get(WebhookDeliveryQueueService);
  });

  it('does nothing when no endpoint is subscribed to the event', async () => {
    endpointRepository.findActiveSubscribedTo.mockResolvedValue([]);

    await service.publish('sales.lead.created', 'org-1', { id: 'lead-1' });

    expect(deliveryRepository.create).not.toHaveBeenCalled();
    expect(queueService.enqueue).not.toHaveBeenCalled();
  });

  it('creates and enqueues a delivery for every subscribed endpoint', async () => {
    endpointRepository.findActiveSubscribedTo.mockResolvedValue([
      {
        id: 'endpoint-1',
        organizationId: 'org-1',
        url: 'https://a.example/hook',
        description: null,
        encryptedSecret: 'enc',
        eventTypes: ['sales.lead.created'],
        status: WebhookEndpointStatus.ACTIVE,
        createdByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'endpoint-2',
        organizationId: 'org-1',
        url: 'https://b.example/hook',
        description: null,
        encryptedSecret: 'enc',
        eventTypes: ['sales.lead.created'],
        status: WebhookEndpointStatus.ACTIVE,
        createdByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    deliveryRepository.create
      .mockResolvedValueOnce({
        id: 'delivery-1',
        endpointId: 'endpoint-1',
        eventType: 'sales.lead.created',
        payload: { id: 'lead-1' },
        status: 'PENDING' as never,
        responseStatusCode: null,
        responseBody: null,
        attemptCount: 0,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .mockResolvedValueOnce({
        id: 'delivery-2',
        endpointId: 'endpoint-2',
        eventType: 'sales.lead.created',
        payload: { id: 'lead-1' },
        status: 'PENDING' as never,
        responseStatusCode: null,
        responseBody: null,
        attemptCount: 0,
        deliveredAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

    await service.publish('sales.lead.created', 'org-1', { id: 'lead-1' });

    expect(deliveryRepository.create).toHaveBeenCalledTimes(2);
    expect(queueService.enqueue).toHaveBeenCalledWith('delivery-1');
    expect(queueService.enqueue).toHaveBeenCalledWith('delivery-2');
  });
});
