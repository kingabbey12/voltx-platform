import { Prisma } from '@prisma/client';
import { AIProviderName } from '../../models/ai-model.types';
import { AgentEntity } from './agent.entity';
import { AgentRunEntity, AgentRunStatus } from './agent-run.entity';

interface AgentRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  configuration: Prisma.JsonValue;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface AgentRunRecord {
  id: string;
  agentId: string;
  conversationId: string;
  status: AgentRunStatus;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tokenUsage: Prisma.JsonValue;
  error: string | null;
  createdAt: Date;
}

export function toAgentEntity(record: AgentRecord): AgentEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    description: record.description,
    systemPrompt: record.systemPrompt,
    provider: toProviderName(record.provider),
    model: record.model,
    configuration: toObject(record.configuration),
    enabled: record.enabled,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}

export function toAgentRunEntity(record: AgentRunRecord): AgentRunEntity {
  return {
    id: record.id,
    agentId: record.agentId,
    conversationId: record.conversationId,
    status: record.status,
    input: toObject(record.input),
    output: toObject(record.output),
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    tokenUsage: toObject(record.tokenUsage),
    error: record.error,
    createdAt: record.createdAt,
  };
}

export function toJsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function toProviderName(value: string): AIProviderName {
  switch (value) {
    case 'anthropic':
    case 'google':
    case 'openai':
      return value;
    default:
      return 'openai';
  }
}
