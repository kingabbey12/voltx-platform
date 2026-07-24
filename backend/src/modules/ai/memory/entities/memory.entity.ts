export type MemoryScope = 'CONVERSATION' | 'LONG_TERM' | 'WORKING' | 'SESSION';

export interface MemoryEntity {
  id: string;
  organizationId: string;
  userId: string;
  conversationId: string;
  agentId: string | null;
  scope: MemoryScope;
  category: string;
  importance: number;
  content: string;
  embeddingId: string | null;
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
