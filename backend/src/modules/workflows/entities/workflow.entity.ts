export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface WorkflowEntity {
  id: string;
  organizationId: string;
  name: string;
  description: string | null;
  status: WorkflowStatus;
  publishedVersion: number | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
