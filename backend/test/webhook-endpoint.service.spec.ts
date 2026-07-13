import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WebhookEndpointStatus } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { OutboundHttpGuardService } from '../src/modules/ai/tools/outbound-http-guard.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { WebhookEndpointEntity } from '../src/modules/webhooks/entities/webhook-endpoint.entity';
import { WebhookDeliveryEntity } from '../src/modules/webhooks/entities/webhook-delivery.entity';
import { WebhookDeliveryQueueService } from '../src/modules/webhooks/jobs/webhook-delivery-queue.service';
import { WebhookDeliveryRepository } from '../src/modules/webhooks/webhook-delivery.repository';
import { WebhookEndpointRepository } from '../src/modules/webhooks/webhook-endpoint.repository';
import { WebhookEndpointService } from '../src/modules/webhooks/webhook-endpoint.service';

function makeEndpoint(overrides: Partial<WebhookEndpointEntity> = {}): WebhookEndpointEntity {
  return {
    id: 'endpoint-1',
    organizationId: 'org-1',
    url: 'https://acme.example/webhooks/voltx',
    description: null,
    encryptedSecret: 'encrypted',
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
    status: 'SUCCEEDED',
    responseStatusCode: 200,
    responseBody: 'ok',
    attemptCount: 1,
    deliveredAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('WebhookEndpointService', () => {
  let service: WebhookEndpointService;
  let repository: jest.Mocked<WebhookEndpointRepository>;
  let deliveryRepository: jest.Mocked<WebhookDeliveryRepository>;
  let queueService: jest.Mocked<WebhookDeliveryQueueService>;
  let outboundHttpGuard: jest.Mocked<OutboundHttpGuardService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookEndpointService,
        {
          provide: WebhookEndpointRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findByIdInOrganization: jest.fn(),
            update: jest.fn(),
            rotateSecret: jest.fn(),
            setStatus: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: WebhookDeliveryRepository,
          useValue: {
            listByEndpoint: jest.fn(),
            findByIdForEndpoint: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: WebhookDeliveryQueueService,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: OutboundHttpGuardService,
          useValue: { assertUrlIsSafeDestination: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: EncryptionService,
          useValue: { encrypt: jest.fn((value: string) => `enc:${value}`) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get(WebhookEndpointService);
    repository = module.get(WebhookEndpointRepository);
    deliveryRepository = module.get(WebhookDeliveryRepository);
    queueService = module.get(WebhookDeliveryQueueService);
    outboundHttpGuard = module.get(OutboundHttpGuardService);
    tenantContextService = module.get(TenantContextService);
  });

  describe('cross-tenant isolation', () => {
    it('never touches the repository when the caller is not a member of the requested organization', async () => {
      tenantContextService.assertOrganizationAccess.mockImplementation(() => {
        throw new ForbiddenException('Cross-tenant access is forbidden');
      });

      await expect(
        service.create('org-not-mine', 'user-1', {
          url: 'https://acme.example/hook',
          eventTypes: ['sales.lead.created'],
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();

      await expect(service.list('org-not-mine')).rejects.toThrow(ForbiddenException);
      expect(repository.listByOrganization).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejects an unknown event type', async () => {
      await expect(
        service.create('org-1', 'user-1', {
          url: 'https://acme.example/hook',
          eventTypes: ['not.a.real.event'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a non-https URL', async () => {
      await expect(
        service.create('org-1', 'user-1', {
          url: 'http://acme.example/hook',
          eventTypes: ['sales.lead.created'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a URL the SSRF guard blocks', async () => {
      outboundHttpGuard.assertUrlIsSafeDestination.mockRejectedValueOnce(
        new BadRequestException('blocked'),
      );

      await expect(
        service.create('org-1', 'user-1', {
          url: 'https://169.254.169.254/hook',
          eventTypes: ['sales.lead.created'],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('registers an endpoint and returns the signing secret exactly once', async () => {
      repository.create.mockResolvedValue(makeEndpoint());

      const result = await service.create('org-1', 'user-1', {
        url: 'https://acme.example/webhooks/voltx',
        eventTypes: ['sales.lead.created'],
      });

      expect(result.secret).toMatch(/^whsec_/);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', eventTypes: ['sales.lead.created'] }),
      );
    });
  });

  describe('lifecycle', () => {
    it('throws NotFoundException for an endpoint outside the organization', async () => {
      repository.findByIdInOrganization.mockResolvedValue(null);
      await expect(service.getOrThrow('endpoint-1', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('suspends and reactivates an endpoint', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeEndpoint());
      repository.setStatus.mockResolvedValue(
        makeEndpoint({ status: WebhookEndpointStatus.SUSPENDED }),
      );

      const result = await service.setStatus(
        'endpoint-1',
        'org-1',
        WebhookEndpointStatus.SUSPENDED,
      );

      expect(result.status).toBe(WebhookEndpointStatus.SUSPENDED);
    });

    it('rotates the signing secret and returns it exactly once', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeEndpoint());
      const result = await service.rotateSecret('endpoint-1', 'org-1');
      expect(result.secret).toMatch(/^whsec_/);
      expect(repository.rotateSecret).toHaveBeenCalled();
    });

    it('deletes an endpoint', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeEndpoint());
      await service.delete('endpoint-1', 'org-1');
      expect(repository.delete).toHaveBeenCalledWith('endpoint-1');
    });
  });

  describe('deliveries', () => {
    it('lists deliveries for an owned endpoint', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeEndpoint());
      deliveryRepository.listByEndpoint.mockResolvedValue([makeDelivery()]);

      const result = await service.listDeliveries('endpoint-1', 'org-1');
      expect(result).toHaveLength(1);
    });

    it('throws NotFoundException replaying a delivery that does not belong to the endpoint', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeEndpoint());
      deliveryRepository.findByIdForEndpoint.mockResolvedValue(null);

      await expect(
        service.replayDelivery('endpoint-1', 'not-its-delivery', 'org-1'),
      ).rejects.toThrow(NotFoundException);
      expect(deliveryRepository.create).not.toHaveBeenCalled();
    });

    it('creates a brand-new delivery row and enqueues it, leaving the original untouched', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeEndpoint());
      const original = makeDelivery();
      deliveryRepository.findByIdForEndpoint.mockResolvedValue(original);
      deliveryRepository.create.mockResolvedValue(
        makeDelivery({ id: 'delivery-2', attemptCount: 0, status: 'PENDING' as never }),
      );

      const result = await service.replayDelivery('endpoint-1', 'delivery-1', 'org-1');

      expect(result.id).toBe('delivery-2');
      expect(deliveryRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ endpointId: 'endpoint-1', eventType: 'sales.lead.created' }),
      );
      expect(queueService.enqueue).toHaveBeenCalledWith('delivery-2');
    });
  });
});
