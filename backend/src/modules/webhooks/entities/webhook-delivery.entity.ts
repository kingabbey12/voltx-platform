import { Prisma, WebhookDelivery, WebhookDeliveryStatus } from '@prisma/client';

export interface WebhookDeliveryEntity {
  id: string;
  endpointId: string;
  eventType: string;
  payload: Prisma.JsonValue;
  status: WebhookDeliveryStatus;
  responseStatusCode: number | null;
  responseBody: string | null;
  attemptCount: number;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toWebhookDeliveryEntity = (record: WebhookDelivery): WebhookDeliveryEntity => ({
  id: record.id,
  endpointId: record.endpointId,
  eventType: record.eventType,
  payload: record.payload,
  status: record.status,
  responseStatusCode: record.responseStatusCode,
  responseBody: record.responseBody,
  attemptCount: record.attemptCount,
  deliveredAt: record.deliveredAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
