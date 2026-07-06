import {
  IntegrationEventType,
  IntegrationProviderKey,
} from '../provider/integration-provider.types';
import { IntegrationHealthStatus } from './integration-connection.entity';

export interface IntegrationWebhookEndpointEntity {
  id: string;
  connectionId: string;
  organizationId: string;
  provider: IntegrationProviderKey;
  token: string;
  enabled: boolean;
  lastReceivedAt: Date | null;
  createdAt: Date;
}

export interface IntegrationEventEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  type: IntegrationEventType;
  externalId: string | null;
  payload: Record<string, unknown>;
  processedAt: Date | null;
  createdAt: Date;
}

export type IntegrationSyncTrigger = 'MANUAL' | 'POLL' | 'WEBHOOK' | 'SCHEDULED';
export type IntegrationSyncStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'PARTIAL';

export interface IntegrationSyncRunEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  trigger: IntegrationSyncTrigger;
  status: IntegrationSyncStatus;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  itemsProcessed: number;
  itemsFailed: number;
  error: string | null;
  createdAt: Date;
}

export interface IntegrationApiUsageLogEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  action: string;
  statusCode: number | null;
  durationMs: number;
  rateLimitRemaining: number | null;
  retryCount: number;
  error: string | null;
  createdAt: Date;
}

export interface IntegrationHealthCheckEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  status: IntegrationHealthStatus;
  latencyMs: number | null;
  message: string | null;
  checkedAt: Date;
}
