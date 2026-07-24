export type PromptStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED';

export interface PromptEntity {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: PromptStatus;
  publishedVersionId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface PromptVersionEntity {
  id: string;
  promptId: string;
  organizationId: string;
  version: number;
  template: string;
  variables: string[];
  model: string | null;
  provider: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export interface PromptTestRunEntity {
  id: string;
  promptId: string;
  promptVersionId: string | null;
  organizationId: string;
  renderedPrompt: string;
  variables: Record<string, string>;
  model: string | null;
  provider: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  response: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

interface PromptRecord {
  id: string;
  organizationId: string;
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  status: PromptStatus;
  publishedVersionId: string | null;
  createdByUserId: string | null;
  updatedByUserId: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface PromptVersionRecord {
  id: string;
  promptId: string;
  organizationId: string;
  version: number;
  template: string;
  variables: unknown;
  model: string | null;
  provider: string | null;
  notes: string | null;
  createdByUserId: string | null;
  createdAt: Date;
}

export function toPromptEntity(record: PromptRecord): PromptEntity {
  return { ...record };
}

export function toPromptVersionEntity(record: PromptVersionRecord): PromptVersionEntity {
  return {
    id: record.id,
    promptId: record.promptId,
    organizationId: record.organizationId,
    version: record.version,
    template: record.template,
    variables: Array.isArray(record.variables)
      ? record.variables.filter((v): v is string => typeof v === 'string')
      : [],
    model: record.model,
    provider: record.provider,
    notes: record.notes,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
  };
}
