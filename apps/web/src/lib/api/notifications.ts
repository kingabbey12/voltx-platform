import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type NotificationCategory =
  | "MESSAGE"
  | "CALL"
  | "MEETING"
  | "CRM"
  | "WORKFLOW"
  | "AI"
  | "SECURITY"
  | "BILLING";

export interface AppNotification {
  id: string;
  organizationId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

export const notificationsApi = {
  list: (query: { page?: number; limit?: number; read?: boolean } = {}) =>
    apiClient.get<PaginatedResult<AppNotification>>("/notifications", {
      query: { page: 1, limit: 20, ...query },
    }),

  getUnreadCount: () => apiClient.get<{ count: number }>("/notifications/unread-count"),

  markRead: (id: string) => apiClient.patch<AppNotification>(`/notifications/${id}/read`),

  markAllRead: () => apiClient.post<{ count: number }>("/notifications/read-all"),
};
