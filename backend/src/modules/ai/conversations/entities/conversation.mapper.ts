import { Prisma } from '@prisma/client';
import { AIMessageRole } from '../../models/ai-model.types';
import { ConversationEntity } from './conversation.entity';
import { MessageEntity } from './message.entity';

interface ConversationRecord {
  id: string;
  organizationId: string;
  userId: string;
  title: string;
  model: string;
  provider: string;
  pinned: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface MessageRecord {
  id: string;
  conversationId: string;
  role: 'SYSTEM' | 'USER' | 'ASSISTANT' | 'TOOL';
  content: string;
  metadata: Prisma.JsonValue;
  tokenUsage: Prisma.JsonValue;
  createdAt: Date;
}

export function toConversationEntity(record: ConversationRecord): ConversationEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    userId: record.userId,
    title: record.title,
    model: record.model,
    provider: record.provider,
    pinned: record.pinned,
    archived: record.archived,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt ?? null,
  };
}

export function toMessageEntity(record: MessageRecord): MessageEntity {
  return {
    id: record.id,
    conversationId: record.conversationId,
    role: toAiMessageRole(record.role),
    content: record.content,
    metadata: toObject(record.metadata),
    tokenUsage: toObject(record.tokenUsage),
    createdAt: record.createdAt,
  };
}

export function toJsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }

  return value as Prisma.InputJsonValue;
}

function toAiMessageRole(role: MessageRecord['role']): AIMessageRole {
  switch (role) {
    case 'SYSTEM':
      return 'system';
    case 'USER':
      return 'user';
    case 'ASSISTANT':
      return 'assistant';
    case 'TOOL':
      return 'tool';
    default:
      return 'assistant';
  }
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
