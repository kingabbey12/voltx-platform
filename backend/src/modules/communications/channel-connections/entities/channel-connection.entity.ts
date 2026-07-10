import { CommsChannel } from '../../channels/channel-provider.interface';

export type CommsChannelConnectionStatus =
  'PENDING' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED' | 'REVOKED' | 'TOKEN_EXPIRED';

export type CommsChannelHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY' | 'UNKNOWN';

export interface CommsChannelConnectionEntity {
  id: string;
  organizationId: string;
  channel: CommsChannel;
  displayName: string;
  status: CommsChannelConnectionStatus;
  externalAccountId: string | null;
  config: Record<string, unknown>;
  lastHealthCheckAt: Date | null;
  lastHealthStatus: CommsChannelHealthStatus;
  lastSyncAt: Date | null;
  lastError: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
