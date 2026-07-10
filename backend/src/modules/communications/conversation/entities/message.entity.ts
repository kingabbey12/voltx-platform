import { CommsChannel, CommsMessageStatus } from '../../channels/channel-provider.interface';

export type CommsMessageDirection = 'INBOUND' | 'OUTBOUND';

export interface CommsMessageEntity {
  id: string;
  organizationId: string;
  conversationId: string;
  senderId: string | null;
  direction: CommsMessageDirection;
  channel: CommsChannel;
  status: CommsMessageStatus;
  body: string;
  externalId: string | null;
  metadata: Record<string, unknown>;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  failedReason: string | null;
  createdAt: Date;
}
