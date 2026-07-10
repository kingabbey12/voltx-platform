export type NotificationCategory =
  'MESSAGE' | 'CALL' | 'MEETING' | 'CRM' | 'WORKFLOW' | 'AI' | 'SECURITY' | 'BILLING';

export interface NotificationEntity {
  id: string;
  organizationId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}
