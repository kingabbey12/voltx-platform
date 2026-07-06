export type KnowledgeEntityType =
  | 'PERSON'
  | 'COMPANY'
  | 'DEAL'
  | 'PROJECT'
  | 'TASK'
  | 'MEETING'
  | 'DOCUMENT'
  | 'EMAIL'
  | 'FILE'
  | 'NOTE'
  | 'AGENT'
  | 'WORKFLOW'
  | 'MEMORY';

export type KnowledgeRelationshipType =
  | 'OWNS'
  | 'WORKS_AT'
  | 'ASSOCIATED_WITH'
  | 'PARTICIPATED_IN'
  | 'ASSIGNED_TO'
  | 'MENTIONS'
  | 'ATTACHED_TO'
  | 'RELATED_TO'
  | 'CREATED_BY';

export interface KnowledgeEntityRecord {
  id: string;
  organizationId: string;
  type: KnowledgeEntityType;
  externalId: string | null;
  label: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface KnowledgeRelationshipEntity {
  id: string;
  organizationId: string;
  fromEntityId: string;
  toEntityId: string;
  type: KnowledgeRelationshipType;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface GraphTraversalNode {
  entity: KnowledgeEntityRecord;
  depth: number;
  viaRelationship: KnowledgeRelationshipType | null;
}
