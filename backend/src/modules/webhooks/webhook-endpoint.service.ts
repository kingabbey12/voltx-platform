import { randomBytes } from 'node:crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { OutboundHttpGuardService } from '../ai/tools/outbound-http-guard.service';
import { EncryptionService } from '../integrations/security/encryption.service';
import {
  CreateWebhookEndpointDto,
  CreateWebhookEndpointResponseDto,
  RotateWebhookEndpointSecretResponseDto,
  UpdateWebhookEndpointDto,
  WebhookEndpointResponseDto,
} from './dto/webhook-endpoint.dto';
import { WebhookDeliveryResponseDto } from './dto/webhook-delivery.dto';
import { WEBHOOK_EVENT_TYPES, isKnownWebhookEventType } from './webhook-event.catalog';
import { WebhookDeliveryQueueService } from './jobs/webhook-delivery-queue.service';
import { WebhookDeliveryRepository } from './webhook-delivery.repository';
import { WebhookEndpointRepository } from './webhook-endpoint.repository';
import { WebhookEndpointStatus } from '@prisma/client';

@Injectable()
export class WebhookEndpointService {
  constructor(
    private readonly repository: WebhookEndpointRepository,
    private readonly deliveryRepository: WebhookDeliveryRepository,
    private readonly queueService: WebhookDeliveryQueueService,
    private readonly outboundHttpGuard: OutboundHttpGuardService,
    private readonly encryptionService: EncryptionService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    organizationId: string,
    createdByUserId: string,
    dto: CreateWebhookEndpointDto,
  ): Promise<CreateWebhookEndpointResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    this.assertEventTypesAreKnown(dto.eventTypes);
    await this.outboundHttpGuard.assertUrlIsSafeDestination(dto.url);
    if (new URL(dto.url).protocol !== 'https:') {
      throw new BadRequestException('Webhook endpoint URL must use https');
    }

    const rawSecret = `whsec_${randomBytes(24).toString('base64url')}`;
    const encryptedSecret = this.encryptionService.encrypt(rawSecret);

    const entity = await this.repository.create({
      organizationId,
      url: dto.url,
      description: dto.description,
      encryptedSecret,
      eventTypes: dto.eventTypes,
      createdByUserId,
    });

    await this.auditService.record({
      action: 'webhook_endpoint.created',
      resource: 'webhook_endpoint',
      resourceId: entity.id,
      metadata: { url: entity.url, eventTypes: entity.eventTypes },
    });

    return { ...WebhookEndpointResponseDto.fromEntity(entity), secret: rawSecret };
  }

  async list(organizationId: string): Promise<WebhookEndpointResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entities = await this.repository.listByOrganization(organizationId);
    return entities.map((entity) => WebhookEndpointResponseDto.fromEntity(entity));
  }

  async getOrThrow(id: string, organizationId: string): Promise<WebhookEndpointResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.findOwnedOrThrow(id, organizationId);
    return WebhookEndpointResponseDto.fromEntity(entity);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateWebhookEndpointDto,
  ): Promise<WebhookEndpointResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    if (dto.eventTypes) {
      this.assertEventTypesAreKnown(dto.eventTypes);
    }
    if (dto.url) {
      await this.outboundHttpGuard.assertUrlIsSafeDestination(dto.url);
      if (new URL(dto.url).protocol !== 'https:') {
        throw new BadRequestException('Webhook endpoint URL must use https');
      }
    }

    const entity = await this.repository.update(id, {
      url: dto.url,
      description: dto.description,
      eventTypes: dto.eventTypes,
    });

    await this.auditService.record({
      action: 'webhook_endpoint.updated',
      resource: 'webhook_endpoint',
      resourceId: id,
    });

    return WebhookEndpointResponseDto.fromEntity(entity);
  }

  async rotateSecret(
    id: string,
    organizationId: string,
  ): Promise<RotateWebhookEndpointSecretResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    const rawSecret = `whsec_${randomBytes(24).toString('base64url')}`;
    const encryptedSecret = this.encryptionService.encrypt(rawSecret);
    await this.repository.rotateSecret(id, encryptedSecret);

    await this.auditService.record({
      action: 'webhook_endpoint.secret_rotated',
      resource: 'webhook_endpoint',
      resourceId: id,
    });

    return { secret: rawSecret };
  }

  async setStatus(
    id: string,
    organizationId: string,
    status: WebhookEndpointStatus,
  ): Promise<WebhookEndpointResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    const entity = await this.repository.setStatus(id, status);
    await this.auditService.record({
      action:
        status === WebhookEndpointStatus.SUSPENDED
          ? 'webhook_endpoint.suspended'
          : 'webhook_endpoint.reactivated',
      resource: 'webhook_endpoint',
      resourceId: id,
    });

    return WebhookEndpointResponseDto.fromEntity(entity);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    await this.repository.delete(id);
    await this.auditService.record({
      action: 'webhook_endpoint.deleted',
      resource: 'webhook_endpoint',
      resourceId: id,
    });
  }

  async listDeliveries(id: string, organizationId: string): Promise<WebhookDeliveryResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    const deliveries = await this.deliveryRepository.listByEndpoint(id);
    return deliveries.map((delivery) => WebhookDeliveryResponseDto.fromEntity(delivery));
  }

  /** Creates a brand-new delivery row for the same event/payload rather
   * than mutating the original — the original delivery's history (its
   * attempt count, status, and response log) is never overwritten. */
  async replayDelivery(
    id: string,
    deliveryId: string,
    organizationId: string,
  ): Promise<WebhookDeliveryResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    const original = await this.deliveryRepository.findByIdForEndpoint(deliveryId, id);
    if (!original) {
      throw new NotFoundException('Webhook delivery not found');
    }

    const replay = await this.deliveryRepository.create({
      endpointId: id,
      eventType: original.eventType,
      payload: original.payload as Prisma.InputJsonValue,
    });
    await this.queueService.enqueue(replay.id);

    await this.auditService.record({
      action: 'webhook_endpoint.delivery_replayed',
      resource: 'webhook_endpoint',
      resourceId: id,
      metadata: { originalDeliveryId: deliveryId, replayDeliveryId: replay.id },
    });

    return WebhookDeliveryResponseDto.fromEntity(replay);
  }

  private async findOwnedOrThrow(id: string, organizationId: string) {
    const entity = await this.repository.findByIdInOrganization(id, organizationId);
    if (!entity) {
      throw new NotFoundException('Webhook endpoint not found');
    }
    return entity;
  }

  private assertEventTypesAreKnown(eventTypes: string[]): void {
    const unknown = eventTypes.filter((eventType) => !isKnownWebhookEventType(eventType));
    if (unknown.length > 0) {
      throw new BadRequestException(
        `Unknown event type(s): ${unknown.join(', ')}. Known types: ${WEBHOOK_EVENT_TYPES.join(', ')}`,
      );
    }
  }
}
