import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { WebhookDeliveryStatus, WebhookEndpointStatus } from '@prisma/client';
import { OutboundHttpGuardService } from '../src/modules/ai/tools/outbound-http-guard.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { WebhookDeliveryEntity } from '../src/modules/webhooks/entities/webhook-delivery.entity';
import { WebhookEndpointEntity } from '../src/modules/webhooks/entities/webhook-endpoint.entity';
import { WebhookDeliveryRepository } from '../src/modules/webhooks/webhook-delivery.repository';
import { WebhookDeliveryService } from '../src/modules/webhooks/webhook-delivery.service';
import { WebhookEndpointRepository } from '../src/modules/webhooks/webhook-endpoint.repository';

function makeEndpoint(overrides: Partial<WebhookEndpointEntity> = {}): WebhookEndpointEntity {
  return {
    id: 'endpoint-1',
    organizationId: 'org-1',
    url: 'https://acme.example/webhooks/voltx',
    description: null,
    encryptedSecret: 'encrypted-secret',
    eventTypes: ['sales.lead.created'],
    status: WebhookEndpointStatus.ACTIVE,
    createdByUserId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeDelivery(overrides: Partial<WebhookDeliveryEntity> = {}): WebhookDeliveryEntity {
  return {
    id: 'delivery-1',
    endpointId: 'endpoint-1',
    eventType: 'sales.lead.created',
    payload: { id: 'lead-1' },
    status: WebhookDeliveryStatus.PENDING,
    responseStatusCode: null,
    responseBody: null,
    attemptCount: 0,
    deliveredAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WebhookDeliveryService', () => {
  let service: WebhookDeliveryService;
  let endpointRepository: jest.Mocked<WebhookEndpointRepository>;
  let deliveryRepository: jest.Mocked<WebhookDeliveryRepository>;
  let outboundHttpGuard: jest.Mocked<OutboundHttpGuardService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookDeliveryService,
        { provide: WebhookEndpointRepository, useValue: { findByIdUnscoped: jest.fn() } },
        {
          provide: WebhookDeliveryRepository,
          useValue: { findByIdUnscoped: jest.fn(), recordAttempt: jest.fn() },
        },
        { provide: OutboundHttpGuardService, useValue: { fetch: jest.fn() } },
        { provide: EncryptionService, useValue: { decrypt: jest.fn(() => 'raw-secret') } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, fallback: unknown) => fallback) },
        },
      ],
    }).compile();

    service = module.get(WebhookDeliveryService);
    endpointRepository = module.get(WebhookEndpointRepository);
    deliveryRepository = module.get(WebhookDeliveryRepository);
    outboundHttpGuard = module.get(OutboundHttpGuardService);
  });

  it('marks the delivery EXHAUSTED without an HTTP call when the endpoint is missing', async () => {
    deliveryRepository.findByIdUnscoped.mockResolvedValue(makeDelivery());
    endpointRepository.findByIdUnscoped.mockResolvedValue(null);

    const result = await service.attemptDelivery('delivery-1', 1, 6);

    expect(result).toBe(true);
    expect(outboundHttpGuard.fetch).not.toHaveBeenCalled();
    expect(deliveryRepository.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ status: WebhookDeliveryStatus.EXHAUSTED }),
    );
  });

  it('marks the delivery EXHAUSTED without an HTTP call when the endpoint is suspended', async () => {
    deliveryRepository.findByIdUnscoped.mockResolvedValue(makeDelivery());
    endpointRepository.findByIdUnscoped.mockResolvedValue(
      makeEndpoint({ status: WebhookEndpointStatus.SUSPENDED }),
    );

    const result = await service.attemptDelivery('delivery-1', 1, 6);

    expect(result).toBe(true);
    expect(outboundHttpGuard.fetch).not.toHaveBeenCalled();
  });

  it('signs the payload and records SUCCEEDED on a 2xx response', async () => {
    deliveryRepository.findByIdUnscoped.mockResolvedValue(makeDelivery());
    endpointRepository.findByIdUnscoped.mockResolvedValue(makeEndpoint());
    outboundHttpGuard.fetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: () => Promise.resolve('ok'),
    } as never);

    const result = await service.attemptDelivery('delivery-1', 1, 6);

    expect(result).toBe(true);
    const [url, toolName, init] = outboundHttpGuard.fetch.mock.calls[0];
    expect(url).toBe('https://acme.example/webhooks/voltx');
    expect(toolName).toBe('webhook_delivery');
    expect((init.headers as Record<string, string>)['X-Voltx-Signature']).toMatch(/^sha256=/);
    expect(deliveryRepository.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ status: WebhookDeliveryStatus.SUCCEEDED, responseStatusCode: 200 }),
    );
  });

  it('records FAILED (not EXHAUSTED) on a non-2xx response when more attempts remain', async () => {
    deliveryRepository.findByIdUnscoped.mockResolvedValue(makeDelivery());
    endpointRepository.findByIdUnscoped.mockResolvedValue(makeEndpoint());
    outboundHttpGuard.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    } as never);

    const result = await service.attemptDelivery('delivery-1', 1, 6);

    expect(result).toBe(false);
    expect(deliveryRepository.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ status: WebhookDeliveryStatus.FAILED, responseStatusCode: 500 }),
    );
  });

  it('records EXHAUSTED on a non-2xx response on the final allowed attempt', async () => {
    deliveryRepository.findByIdUnscoped.mockResolvedValue(makeDelivery());
    endpointRepository.findByIdUnscoped.mockResolvedValue(makeEndpoint());
    outboundHttpGuard.fetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('server error'),
    } as never);

    const result = await service.attemptDelivery('delivery-1', 6, 6);

    expect(result).toBe(false);
    expect(deliveryRepository.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({ status: WebhookDeliveryStatus.EXHAUSTED }),
    );
  });

  it('records EXHAUSTED when the outbound fetch itself throws on the final attempt', async () => {
    deliveryRepository.findByIdUnscoped.mockResolvedValue(makeDelivery());
    endpointRepository.findByIdUnscoped.mockResolvedValue(makeEndpoint());
    outboundHttpGuard.fetch.mockRejectedValue(new Error('DNS resolution failed'));

    const result = await service.attemptDelivery('delivery-1', 6, 6);

    expect(result).toBe(false);
    expect(deliveryRepository.recordAttempt).toHaveBeenCalledWith(
      'delivery-1',
      expect.objectContaining({
        status: WebhookDeliveryStatus.EXHAUSTED,
        responseBody: 'DNS resolution failed',
      }),
    );
  });
});
