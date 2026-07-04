import { AIMessageRole } from '../../models/ai-model.types';

export class MessageEntity {
  id!: string;
  conversationId!: string;
  role!: AIMessageRole;
  content!: string;
  metadata!: Record<string, unknown>;
  tokenUsage!: Record<string, unknown>;
  createdAt!: Date;
}
