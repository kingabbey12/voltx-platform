import { apiClient } from "./client";

/**
 * Client for the Company Workspace endpoints (backend: src/modules/company).
 * Wire types mirror CompanyHomeResponse / RecordTimelineResponse on the
 * server — a read-only projection over existing modules, not a new store.
 */

export interface CompanyHomeSection<T> {
  available: boolean;
  reason?: string;
  total: number;
  items: T[];
}

export interface PersonSummary {
  id: string;
  name: string;
  email: string | null;
  kind: "internal" | "external";
}

export interface DocumentSummary {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
}

export interface ConversationSummary {
  id: string;
  subject: string | null;
  channel: string;
  status: string;
  lastMessageAt: string | null;
}

export interface EventSummary {
  id: string;
  subject: string;
  type: string;
  occurredAt: string;
}

export interface PromiseSummary {
  id: string;
  title: string;
  status: string;
  ownerId: string;
  dueAt: string | null;
}

export interface ApprovalSummary {
  id: string;
  toolName: string;
  status: string;
  summary: string | null;
  approverUserId: string | null;
  createdAt: string;
  decidedAt: string | null;
}

export interface CompanyHomeResponse {
  organization: {
    id: string;
    name: string;
    slug: string;
    industry: string | null;
    website: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  people: CompanyHomeSection<PersonSummary>;
  documents: CompanyHomeSection<DocumentSummary>;
  conversations: CompanyHomeSection<ConversationSummary>;
  events: CompanyHomeSection<EventSummary>;
  promises: CompanyHomeSection<PromiseSummary>;
  assets: { available: false; reason: string };
}

export interface RecordTimelineResponse {
  recordType: string;
  recordId: string;
  createdAt: string;
  updatedAt: string;
  events: CompanyHomeSection<EventSummary>;
  conversations: CompanyHomeSection<ConversationSummary>;
  documents: CompanyHomeSection<DocumentSummary>;
  promises: CompanyHomeSection<PromiseSummary>;
  approvals: CompanyHomeSection<ApprovalSummary>;
}

export const companyApi = {
  getHome: () => apiClient.get<CompanyHomeResponse>("/company/home"),
  getTimeline: (recordType: string, recordId: string) =>
    apiClient.get<RecordTimelineResponse>(
      `/company/timeline/${encodeURIComponent(recordType)}/${encodeURIComponent(recordId)}`,
    ),
};
