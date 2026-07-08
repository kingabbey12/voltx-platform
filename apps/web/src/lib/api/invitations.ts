import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export interface Role {
  id: string;
  key: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
}

export type InvitationStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "REVOKED";
export interface Invitation {
  id: string;
  email: string;
  status: InvitationStatus;
  roleId: string;
  invitedByUserId: string;
  expiresAt: string;
  createdAt: string;
}

export const rolesApi = {
  list: () => apiClient.get<{ items: Role[] }>("/roles"),
};

export const invitationsApi = {
  list: (organizationId: string, query: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<Invitation>>(`/organizations/${organizationId}/invitations`, {
      query: { page: 1, limit: 20, ...query },
    }),

  create: (organizationId: string, input: { email: string; roleId: string }) =>
    apiClient.post<Invitation>(`/organizations/${organizationId}/invitations`, input),

  resend: (organizationId: string, invitationId: string) =>
    apiClient.post<Invitation>(`/organizations/${organizationId}/invitations/${invitationId}/resend`),

  revoke: (organizationId: string, invitationId: string) =>
    apiClient.delete<Invitation>(`/organizations/${organizationId}/invitations/${invitationId}`),
};
