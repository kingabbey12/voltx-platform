export type KnowledgeSourceType =
  | 'CRM_CONTACT'
  | 'CRM_COMPANY'
  | 'CRM_OPPORTUNITY'
  | 'CRM_ACTIVITY'
  | 'NOTE'
  | 'DOCUMENT'
  | 'EMAIL'
  | 'CALENDAR'
  | 'TASK'
  | 'MEETING'
  | 'UPLOADED_FILE'
  | 'AI_MEMORY'
  | 'MESSAGE'
  | 'ISSUE'
  | 'OTHER';

export type KnowledgeSourceStatus = 'ACTIVE' | 'PAUSED' | 'ERROR';

export interface KnowledgeSourceEntity {
  id: string;
  organizationId: string;
  type: KnowledgeSourceType;
  name: string;
  description: string | null;
  config: Record<string, unknown>;
  status: KnowledgeSourceStatus;
  lastIndexedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
