import { WebhookEndpoint, WebhookEndpointStatus } from '@prisma/client';

export interface WebhookEndpointEntity {
  id: string;
  organizationId: string;
  url: string;
  description: string | null;
  encryptedSecret: string;
  eventTypes: string[];
  status: WebhookEndpointStatus;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toWebhookEndpointEntity = (record: WebhookEndpoint): WebhookEndpointEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  url: record.url,
  description: record.description,
  encryptedSecret: record.encryptedSecret,
  eventTypes: record.eventTypes,
  status: record.status,
  createdByUserId: record.createdByUserId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
