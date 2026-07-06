import {
  IntegrationAuthType,
  IntegrationProviderKey,
} from '../provider/integration-provider.types';

export type IntegrationConnectionStatus =
  'PENDING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED' | 'REVOKED' | 'TOKEN_EXPIRED';

export type IntegrationHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface IntegrationConnectionEntity {
  id: string;
  organizationId: string;
  provider: IntegrationProviderKey;
  displayName: string;
  authType: IntegrationAuthType;
  status: IntegrationConnectionStatus;
  externalAccountId: string | null;
  config: Record<string, unknown>;
  version: number;
  lastHealthCheckAt: Date | null;
  lastHealthStatus: IntegrationHealthStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
