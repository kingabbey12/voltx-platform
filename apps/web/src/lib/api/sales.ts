import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type CompanyStatus = "PROSPECT" | "ACTIVE" | "INACTIVE";
export interface Company {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  status: CompanyStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface Contact {
  id: string;
  companyId: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = "NEW" | "QUALIFIED" | "NURTURING" | "DISQUALIFIED" | "CONVERTED";
export interface Lead {
  id: string;
  companyId: string | null;
  contactId: string | null;
  title: string;
  source: string | null;
  status: LeadStatus;
  qualificationScore: number | null;
  qualificationSummary: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStage =
  | "DISCOVERY"
  | "QUALIFICATION"
  | "PROPOSAL"
  | "NEGOTIATION"
  | "CLOSED_WON"
  | "CLOSED_LOST";
export interface Opportunity {
  id: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  title: string;
  stage: OpportunityStage;
  amount: number | null;
  currency: string;
  probability: number;
  expectedCloseAt: string | null;
  insights: string | null;
  nextBestAction: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ActivityType = "CALL" | "EMAIL" | "MEETING" | "TASK" | "NOTE";
export interface Activity {
  id: string;
  companyId: string | null;
  contactId: string | null;
  leadId: string | null;
  opportunityId: string | null;
  type: ActivityType;
  subject: string;
  description: string | null;
  occurredAt: string | null;
  dueAt: string | null;
  completed: boolean;
  meetingSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PageQuery {
  page?: number;
  limit?: number;
  search?: string;
}

/** Optional extra guidance for a sales AI action — mirrors the backend's
 * SalesAiActionDto exactly (`prompt`/`workspaceContext`, not `context`). */
export interface SalesAiActionInput {
  prompt?: string;
  workspaceContext?: string[];
}

/** Mirrors SalesAiActionResponseDto. `assistantMessage`/`toolMessages` are
 * intentionally left untyped here — no CRM screen needs the raw
 * conversation transcript, only the generated text. */
export interface SalesAiActionResult {
  conversationId: string;
  agentRunId: string;
  outputText: string;
}

export const companiesApi = {
  list: (query: PageQuery & { status?: CompanyStatus } = {}) =>
    apiClient.get<PaginatedResult<Company>>("/sales/companies", { query: { page: 1, limit: 20, ...query } }),
  get: (id: string) => apiClient.get<Company>(`/sales/companies/${id}`),
  create: (input: Partial<Company> & { name: string }) => apiClient.post<Company>("/sales/companies", input),
  update: (id: string, input: Partial<Company>) => apiClient.patch<Company>(`/sales/companies/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/sales/companies/${id}`),
};

export const contactsApi = {
  list: (query: PageQuery & { companyId?: string } = {}) =>
    apiClient.get<PaginatedResult<Contact>>("/sales/contacts", { query: { page: 1, limit: 20, ...query } }),
  get: (id: string) => apiClient.get<Contact>(`/sales/contacts/${id}`),
  create: (input: Partial<Contact> & { firstName: string; lastName: string }) =>
    apiClient.post<Contact>("/sales/contacts", input),
  update: (id: string, input: Partial<Contact>) => apiClient.patch<Contact>(`/sales/contacts/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/sales/contacts/${id}`),
  draftEmail: (id: string, input: SalesAiActionInput = {}) =>
    apiClient.post<SalesAiActionResult>(`/sales/contacts/${id}/draft-email`, input),
};

export const leadsApi = {
  list: (query: PageQuery & { status?: LeadStatus } = {}) =>
    apiClient.get<PaginatedResult<Lead>>("/sales/leads", { query: { page: 1, limit: 20, ...query } }),
  get: (id: string) => apiClient.get<Lead>(`/sales/leads/${id}`),
  create: (input: Partial<Lead> & { title: string }) => apiClient.post<Lead>("/sales/leads", input),
  update: (id: string, input: Partial<Lead>) => apiClient.patch<Lead>(`/sales/leads/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/sales/leads/${id}`),
  qualify: (id: string, input: SalesAiActionInput = {}) =>
    apiClient.post<SalesAiActionResult>(`/sales/leads/${id}/qualify`, input),
};

export const opportunitiesApi = {
  list: (query: PageQuery & { stage?: OpportunityStage } = {}) =>
    apiClient.get<PaginatedResult<Opportunity>>("/sales/opportunities", {
      query: { page: 1, limit: 20, ...query },
    }),
  get: (id: string) => apiClient.get<Opportunity>(`/sales/opportunities/${id}`),
  create: (input: Partial<Opportunity> & { title: string }) =>
    apiClient.post<Opportunity>("/sales/opportunities", input),
  update: (id: string, input: Partial<Opportunity>) =>
    apiClient.patch<Opportunity>(`/sales/opportunities/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/sales/opportunities/${id}`),
  insights: (id: string, input: SalesAiActionInput = {}) =>
    apiClient.post<SalesAiActionResult>(`/sales/opportunities/${id}/insights`, input),
  nextBestAction: (id: string, input: SalesAiActionInput = {}) =>
    apiClient.post<SalesAiActionResult>(`/sales/opportunities/${id}/next-best-action`, input),
};

export const activitiesApi = {
  list: (
    query: PageQuery & {
      companyId?: string;
      contactId?: string;
      leadId?: string;
      opportunityId?: string;
      type?: ActivityType;
    } = {},
  ) => apiClient.get<PaginatedResult<Activity>>("/sales/activities", { query: { page: 1, limit: 20, ...query } }),
  get: (id: string) => apiClient.get<Activity>(`/sales/activities/${id}`),
  create: (input: Partial<Activity> & { type: ActivityType; subject: string }) =>
    apiClient.post<Activity>("/sales/activities", input),
  update: (id: string, input: Partial<Activity>) => apiClient.patch<Activity>(`/sales/activities/${id}`, input),
  delete: (id: string) => apiClient.delete<void>(`/sales/activities/${id}`),
  meetingSummary: (id: string, input: SalesAiActionInput = {}) =>
    apiClient.post<SalesAiActionResult>(`/sales/activities/${id}/meeting-summary`, input),
};
