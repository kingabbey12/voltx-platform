import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export interface AiMemory {
  id: string;
  conversationId: string;
  category: string;
  importance: number | null;
  content: string;
  embeddingId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const memoryApi = {
  list: (query: { page?: number; limit?: number; category?: string } = {}) =>
    apiClient.get<PaginatedResult<AiMemory>>("/ai/memories", {
      query: { page: 1, limit: 50, ...query },
    }),

  create: (input: { conversationId: string; category: string; content: string; importance?: number }) =>
    apiClient.post<AiMemory>("/ai/memories", input),

  remove: (id: string) => apiClient.delete<AiMemory>(`/ai/memories/${id}`),
};
