import { Injectable } from '@nestjs/common';
import { WebhookEndpointStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WebhookEndpointEntity, toWebhookEndpointEntity } from './entities/webhook-endpoint.entity';

export interface CreateWebhookEndpointData {
  organizationId: string;
  url: string;
  description?: string;
  encryptedSecret: string;
  eventTypes: string[];
  createdByUserId?: string;
}

export interface UpdateWebhookEndpointData {
  url?: string;
  description?: string;
  eventTypes?: string[];
}

@Injectable()
export class WebhookEndpointRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWebhookEndpointData): Promise<WebhookEndpointEntity> {
    const record = await this.prisma.system.webhookEndpoint.create({ data });
    return toWebhookEndpointEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<WebhookEndpointEntity[]> {
    const records = await this.prisma.system.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toWebhookEndpointEntity);
  }

  async findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<WebhookEndpointEntity | null> {
    const record = await this.prisma.system.webhookEndpoint.findFirst({
      where: { id, organizationId },
    });
    return record ? toWebhookEndpointEntity(record) : null;
  }

  /** Unscoped — used only by the delivery worker, which resolves an
   * endpoint from a queued delivery's endpointId outside any HTTP request
   * (and therefore outside any tenant context). */
  async findByIdUnscoped(id: string): Promise<WebhookEndpointEntity | null> {
    const record = await this.prisma.system.webhookEndpoint.findUnique({ where: { id } });
    return record ? toWebhookEndpointEntity(record) : null;
  }

  /** Unscoped by caller identity (the organizationId here is the event's
   * own organization, supplied by the publisher, not derived from any
   * request) — resolves every active endpoint subscribed to a given event
   * type for WebhookDispatchService.publish(). */
  async findActiveSubscribedTo(
    organizationId: string,
    eventType: string,
  ): Promise<WebhookEndpointEntity[]> {
    const records = await this.prisma.system.webhookEndpoint.findMany({
      where: {
        organizationId,
        status: WebhookEndpointStatus.ACTIVE,
        eventTypes: { has: eventType },
      },
    });
    return records.map(toWebhookEndpointEntity);
  }

  async update(id: string, data: UpdateWebhookEndpointData): Promise<WebhookEndpointEntity> {
    const record = await this.prisma.system.webhookEndpoint.update({ where: { id }, data });
    return toWebhookEndpointEntity(record);
  }

  async rotateSecret(id: string, encryptedSecret: string): Promise<WebhookEndpointEntity> {
    const record = await this.prisma.system.webhookEndpoint.update({
      where: { id },
      data: { encryptedSecret },
    });
    return toWebhookEndpointEntity(record);
  }

  async setStatus(id: string, status: WebhookEndpointStatus): Promise<WebhookEndpointEntity> {
    const record = await this.prisma.system.webhookEndpoint.update({
      where: { id },
      data: { status },
    });
    return toWebhookEndpointEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.system.webhookEndpoint.delete({ where: { id } });
  }
}
