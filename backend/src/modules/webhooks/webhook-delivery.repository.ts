import { Injectable } from '@nestjs/common';
import { Prisma, WebhookDeliveryStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WebhookDeliveryEntity, toWebhookDeliveryEntity } from './entities/webhook-delivery.entity';

export interface CreateWebhookDeliveryData {
  endpointId: string;
  eventType: string;
  payload: Prisma.InputJsonValue;
}

export interface RecordDeliveryAttemptData {
  status: WebhookDeliveryStatus;
  responseStatusCode?: number;
  responseBody?: string;
  deliveredAt?: Date;
}

@Injectable()
export class WebhookDeliveryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWebhookDeliveryData): Promise<WebhookDeliveryEntity> {
    const record = await this.prisma.system.webhookDelivery.create({ data });
    return toWebhookDeliveryEntity(record);
  }

  /** Unscoped — used only by the delivery worker, resolving a delivery
   * purely from its own id outside any HTTP request/tenant context. */
  async findByIdUnscoped(id: string): Promise<WebhookDeliveryEntity | null> {
    const record = await this.prisma.system.webhookDelivery.findUnique({ where: { id } });
    return record ? toWebhookDeliveryEntity(record) : null;
  }

  async findByIdForEndpoint(id: string, endpointId: string): Promise<WebhookDeliveryEntity | null> {
    const record = await this.prisma.system.webhookDelivery.findFirst({
      where: { id, endpointId },
    });
    return record ? toWebhookDeliveryEntity(record) : null;
  }

  async listByEndpoint(endpointId: string): Promise<WebhookDeliveryEntity[]> {
    const records = await this.prisma.system.webhookDelivery.findMany({
      where: { endpointId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toWebhookDeliveryEntity);
  }

  async recordAttempt(id: string, data: RecordDeliveryAttemptData): Promise<WebhookDeliveryEntity> {
    const record = await this.prisma.system.webhookDelivery.update({
      where: { id },
      data: {
        status: data.status,
        responseStatusCode: data.responseStatusCode,
        responseBody: data.responseBody?.slice(0, 4000),
        deliveredAt: data.deliveredAt,
        attemptCount: { increment: 1 },
      },
    });
    return toWebhookDeliveryEntity(record);
  }
}
