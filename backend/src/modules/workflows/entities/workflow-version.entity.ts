import { WorkflowDefinition } from '../definition/workflow-definition.types';

export interface WorkflowVersionEntity {
  id: string;
  organizationId: string;
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
  createdBy: string;
  createdAt: Date;
}
