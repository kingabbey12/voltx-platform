import { apiClient } from "./client";

export interface AssistantSession {
  conversationId: string;
  agentId: string;
  suggestedPrompts: string[];
}

export const assistantApi = {
  createSession: () => apiClient.post<AssistantSession>("/ai/assistant/session"),
};