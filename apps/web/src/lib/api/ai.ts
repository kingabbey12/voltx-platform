import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export interface Conversation {
  id: string;
  title: string;
  model: string;
  provider: string;
  pinned: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MessageRole = "system" | "user" | "assistant" | "tool";

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  metadata: Record<string, unknown>;
  tokenUsage: Record<string, unknown>;
  createdAt: string;
}

export interface CreateMessageResult {
  userMessage: Message;
  toolMessages: Message[];
  assistantMessage: Message | null;
}

export interface ListConversationsQuery {
  page?: number;
  limit?: number;
  search?: string;
  pinned?: boolean;
  archived?: boolean;
}

export const aiApi = {
  listConversations: (query: ListConversationsQuery = {}) =>
    apiClient.get<PaginatedResult<Conversation>>("/ai/conversations", {
      query: { page: 1, limit: 20, ...query },
    }),

  getConversation: (id: string) => apiClient.get<Conversation>(`/ai/conversations/${id}`),

  createConversation: (input: { title?: string; provider?: string; model?: string } = {}) =>
    apiClient.post<Conversation>("/ai/conversations", input),

  updateConversation: (id: string, input: { title?: string; pinned?: boolean; archived?: boolean }) =>
    apiClient.patch<Conversation>(`/ai/conversations/${id}`, input),

  deleteConversation: (id: string) => apiClient.delete<void>(`/ai/conversations/${id}`),

  listMessages: (conversationId: string, query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<Message>>(`/ai/conversations/${conversationId}/messages`, {
      query: { page: 1, limit: 50, ...query },
    }),

  sendMessage: (
    conversationId: string,
    content: string,
    workspaceContext?: string[],
    attachmentIds?: string[],
  ) =>
    apiClient.post<CreateMessageResult>(`/ai/conversations/${conversationId}/messages`, {
      content,
      ...(workspaceContext && workspaceContext.length > 0 ? { workspaceContext } : {}),
      ...(attachmentIds && attachmentIds.length > 0 ? { attachmentIds } : {}),
    }),

  executeTool: (conversationId: string, toolName: string, input: Record<string, unknown>) =>
    apiClient.post<{ execution: { status: string }; result: { content: string } }>(
      "/ai/tools/execute",
      { conversationId, toolName, input },
    ),
};
