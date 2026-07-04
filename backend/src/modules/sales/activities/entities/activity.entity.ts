export type ActivityType = 'CALL' | 'EMAIL' | 'MEETING' | 'TASK' | 'NOTE';

export interface ActivityEntity {
  id: string;
  organizationId: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  type: ActivityType;
  subject: string;
  description: string | null;
  occurredAt: Date | null;
  dueAt: Date | null;
  completed: boolean;
  meetingSummary: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
