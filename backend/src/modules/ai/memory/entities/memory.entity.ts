export interface MemoryEntity {
  id: string;
  organizationId: string;
  userId: string;
  conversationId: string;
  category: string;
  importance: number;
  content: string;
  embeddingId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}
