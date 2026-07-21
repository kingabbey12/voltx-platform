import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

interface PageQuery {
  page?: number;
  limit?: number;
}

export type PromiseStatus = "PROPOSED" | "STANDING" | "FULFILLED" | "RELEASED" | "BROKEN";
export type PromisePartyRole = "OBLIGOR" | "OBLIGEE";

export interface PromiseParty {
  id: string;
  role: PromisePartyRole;
  contactId: string | null;
  userId: string | null;
}

// Named PromiseRecord, not Promise — the latter would shadow the built-in
// Promise<T> in every file that imports it.
export interface PromiseRecord {
  id: string;
  title: string;
  status: PromiseStatus;
  ownerId: string;
  dueAt: string | null;
  parties: PromiseParty[];
  createdAt: string;
  updatedAt: string;
}

export interface PromiseEvent {
  id: string;
  type: "CREATED" | "STATUS_CHANGED" | "AI_RECOMMENDATION" | "NOTE_ADDED";
  actorId: string | null;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export interface CreatePromiseInput {
  title: string;
  ownerId: string;
  dueAt?: string;
  parties: Array<{ role: PromisePartyRole; contactId?: string; userId?: string }>;
}

export interface UpdatePromiseInput {
  title?: string;
  ownerId?: string;
  dueAt?: string | null;
  parties?: Array<{ role: PromisePartyRole; contactId?: string; userId?: string }>;
}

export const promisesApi = {
  list: (query: PageQuery & { status?: PromiseStatus; ownerId?: string } = {}) =>
    apiClient.get<PaginatedResult<PromiseRecord>>("/promises", {
      query: { page: 1, limit: 100, ...query },
    }),
  get: (id: string) => apiClient.get<PromiseRecord>(`/promises/${id}`),
  create: (input: CreatePromiseInput) => apiClient.post<PromiseRecord>("/promises", input),
  update: (id: string, input: UpdatePromiseInput) =>
    apiClient.patch<PromiseRecord>(`/promises/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/promises/${id}`),
  events: (id: string) => apiClient.get<PromiseEvent[]>(`/promises/${id}/events`),
  stand: (id: string, note?: string) =>
    apiClient.post<PromiseRecord>(`/promises/${id}/stand`, { note }),
  fulfill: (id: string, note?: string) =>
    apiClient.post<PromiseRecord>(`/promises/${id}/fulfill`, { note }),
  release: (id: string, note?: string) =>
    apiClient.post<PromiseRecord>(`/promises/${id}/release`, { note }),
  break: (id: string, note?: string) =>
    apiClient.post<PromiseRecord>(`/promises/${id}/break`, { note }),
};
