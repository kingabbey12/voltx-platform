import { CommsChannel } from '../../channels/channel-provider.interface';

export type CommsConversationStatus = 'OPEN' | 'PINNED' | 'ARCHIVED';
export type CommsConversationPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CommsConversationEntity {
  id: string;
  organizationId: string;
  connectionId: string;
  contactId: string | null;
  assigneeId: string | null;
  channel: CommsChannel;
  subject: string | null;
  status: CommsConversationStatus;
  priority: CommsConversationPriority;
  unread: boolean;
  externalThreadId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
