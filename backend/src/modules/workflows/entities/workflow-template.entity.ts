import { WorkflowDefinition } from '../definition/workflow-definition.types';

export interface WorkflowTemplateEntity {
  id: string;
  organizationId: string | null;
  key: string;
  name: string;
  description: string | null;
  category: string;
  definition: WorkflowDefinition;
  isSystem: boolean;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
