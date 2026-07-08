import { apiClient } from "./client";

export interface OperatorSession {
  conversationId: string;
  readOnlyAgentId: string;
  fullAgentId: string;
}

export const operatorApi = {
  createSession: () => apiClient.post<OperatorSession>("/ai/operator/session"),
};
