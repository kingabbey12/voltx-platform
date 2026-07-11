export type WorkflowVariableType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';

export interface WorkflowVariableEntity {
  id: string;
  organizationId: string;
  workflowId: string | null;
  key: string;
  type: WorkflowVariableType;
  defaultValue: unknown;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
