import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export const COMMS_CHANNEL_KEYS = [
  "GMAIL",
  "OUTLOOK",
  "WHATSAPP",
  "TWILIO_VOICE",
  "TWILIO_SMS",
  "SLACK",
  "TEAMS",
] as const;
export type CommsChannel = (typeof COMMS_CHANNEL_KEYS)[number];

export interface ChannelConnection {
  id: string;
  channel: CommsChannel;
  displayName: string;
  status: string;
  externalAccountId: string | null;
  lastSyncAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  id: string;
  connectionId: string;
  contactId: string | null;
  assigneeId: string | null;
  channel: CommsChannel;
  subject: string | null;
  status: "OPEN" | "PINNED" | "ARCHIVED";
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  unread: boolean;
  lastMessageAt: string | null;
  createdAt: string;
}

export interface CommsMessage {
  id: string;
  conversationId: string;
  direction: "INBOUND" | "OUTBOUND";
  channel: CommsChannel;
  status: string;
  body: string;
  createdAt: string;
}

export interface ListConversationsQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  unread?: boolean;
  assigneeId?: string;
  priority?: string;
}

export const communicationsApi = {
  listConnections: (query: { page?: number; limit?: number; channel?: string } = {}) =>
    apiClient.get<PaginatedResult<ChannelConnection>>("/communications/connections", {
      query: { page: 1, limit: 20, ...query },
    }),

  initiateOAuth: (input: { channel: string; displayName: string; redirectUri: string }) =>
    apiClient.post<{ connectionId: string; authorizationUrl: string }>(
      "/communications/connections/oauth/initiate",
      input,
    ),

  completeOAuth: (input: { connectionId: string; code: string; redirectUri: string }) =>
    apiClient.post<ChannelConnection>("/communications/connections/oauth/complete", input),

  disconnectConnection: (id: string) =>
    apiClient.delete<{ disconnected: boolean }>(`/communications/connections/${id}`),

  listConversations: (query: ListConversationsQuery = {}) =>
    apiClient.get<PaginatedResult<Conversation>>("/communications/conversations", {
      query: { page: 1, limit: 30, ...query },
    }),

  getConversation: (id: string) => apiClient.get<Conversation>(`/communications/conversations/${id}`),

  updateConversation: (
    id: string,
    input: {
      status?: string;
      priority?: string;
      unread?: boolean;
      assigneeId?: string | null;
      contactId?: string | null;
    },
  ) => apiClient.patch<Conversation>(`/communications/conversations/${id}`, input),

  listMessages: (conversationId: string, query: { page?: number; limit?: number } = {}) =>
    apiClient.get<{ items: CommsMessage[]; total: number }>(
      `/communications/conversations/${conversationId}/messages`,
      { query: { page: 1, limit: 50, ...query } },
    ),

  sendMessage: (conversationId: string, body: string) =>
    apiClient.post<CommsMessage>(`/communications/conversations/${conversationId}/messages`, { body }),
};
