import { Prisma } from '@prisma/client';
import { AIProviderName } from '../../models/ai-model.types';

export interface AgentVersionEntity {
  id: string;
  organizationId: string;
  agentId: string;
  version: number;
  name: string;
  description: string;
  systemPrompt: string;
  provider: AIProviderName;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  promptId: string | null;
  knowledgeCollectionId: string | null;
  configuration: Record<string, unknown>;
  createdByUserId: string | null;
  createdAt: Date;
}

interface AgentVersionRecord {
  id: string;
  organizationId: string;
  agentId: string;
  version: number;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  promptId: string | null;
  knowledgeCollectionId: string | null;
  configuration: Prisma.JsonValue;
  createdByUserId: string | null;
  createdAt: Date;
}

export function toAgentVersionEntity(record: AgentVersionRecord): AgentVersionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    agentId: record.agentId,
    version: record.version,
    name: record.name,
    description: record.description,
    systemPrompt: record.systemPrompt,
    provider: toProviderName(record.provider),
    model: record.model,
    temperature: record.temperature,
    maxTokens: record.maxTokens,
    promptId: record.promptId,
    knowledgeCollectionId: record.knowledgeCollectionId,
    configuration: toObject(record.configuration),
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function toProviderName(value: string): AIProviderName {
  switch (value) {
    case 'anthropic':
    case 'google':
    case 'openai':
    case 'xai':
    case 'groq':
    case 'mistral':
    case 'deepseek':
    case 'ollama':
    case 'openrouter':
    case 'azure-openai':
      return value;
    default:
      return 'openai';
  }
}
