import { apiClient } from "./client";

export interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateConsentRecordInput {
  userId: string;
  consentType: string;
  granted: boolean;
  metadata?: Record<string, unknown>;
}

export interface ConsentHistoryQuery {
  userId?: string;
  consentType?: string;
}

export interface GdprExportSection {
  model: string;
  label: string;
  rowCount: number;
}

export interface GdprExportResult {
  organizationId: string;
  userId: string;
  exportedAt: string;
  downloadUrl: string;
  expiresAt: string;
  sections: GdprExportSection[];
  excludedFromErasure: string[];
}

export interface GdprErasureOutcome {
  model: string;
  label: string;
  action: "DELETE" | "ANONYMIZE" | "EXCLUDED";
  affected: number;
  reason?: string;
}

export interface GdprDeletionResult {
  organizationId: string;
  userId: string;
  results: GdprErasureOutcome[];
  globalIdentityScrubbed: boolean;
}

export type LegalHoldStatus = "ACTIVE" | "RELEASED";

export interface LegalHold {
  id: string;
  name: string;
  reason: string;
  targetUserId: string | null;
  status: LegalHoldStatus;
  scope: Record<string, unknown>;
  createdBy: string;
  releasedBy: string | null;
  releasedAt: string | null;
  createdAt: string;
}

export interface CreateLegalHoldInput {
  name: string;
  reason: string;
  targetUserId?: string;
  scope?: Record<string, unknown>;
}

export interface UpdateLegalHoldInput {
  name?: string;
  reason?: string;
  scope?: Record<string, unknown>;
}

export type AuditExportFormat = "CSV" | "JSON";
export type AuditExportStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface AuditExport {
  id: string;
  status: AuditExportStatus;
  format: AuditExportFormat;
  fromDate: string;
  toDate: string;
  rowCount: number | null;
  downloadUrl: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface CreateAuditExportInput {
  fromDate: string;
  toDate: string;
  format?: AuditExportFormat;
}

export interface AuditChainVerifyResult {
  valid: boolean;
  checked: number;
  brokenAtIndex: number | null;
  brokenAuditLogId: string | null;
}

export type RetentionResourceType = "AUDIT_LOG" | "CONVERSATION" | "NOTIFICATION" | "ATTACHMENT";
export type RetentionAction = "DELETE" | "ANONYMIZE";

export interface RetentionPolicy {
  id: string;
  resourceType: RetentionResourceType;
  retentionDays: number;
  action: RetentionAction;
  isActive: boolean;
  createdBy: string;
  createdAt: string;
}

export interface CreateRetentionPolicyInput {
  resourceType: RetentionResourceType;
  retentionDays: number;
  action: RetentionAction;
}

export interface UpdateRetentionPolicyInput {
  retentionDays?: number;
  action?: RetentionAction;
  isActive?: boolean;
}

export const complianceApi = {
  // Consent records
  listConsentRecords: (query: ConsentHistoryQuery = {}) =>
    apiClient.get<ConsentRecord[]>("/compliance/consent-records", { query: { ...query } }),
  getConsentRecord: (id: string) => apiClient.get<ConsentRecord>(`/compliance/consent-records/${id}`),
  createConsentRecord: (input: CreateConsentRecordInput) =>
    apiClient.post<ConsentRecord>("/compliance/consent-records", input),

  // GDPR
  exportUserData: (userId: string) =>
    apiClient.post<GdprExportResult>("/compliance/gdpr/export", { userId }),
  deleteUserData: (userId: string) =>
    apiClient.post<GdprDeletionResult>("/compliance/gdpr/delete", { userId }),

  // Legal holds
  listLegalHolds: () => apiClient.get<LegalHold[]>("/compliance/legal-holds"),
  getLegalHold: (id: string) => apiClient.get<LegalHold>(`/compliance/legal-holds/${id}`),
  createLegalHold: (input: CreateLegalHoldInput) =>
    apiClient.post<LegalHold>("/compliance/legal-holds", input),
  updateLegalHold: (id: string, input: UpdateLegalHoldInput) =>
    apiClient.patch<LegalHold>(`/compliance/legal-holds/${id}`, input),
  releaseLegalHold: (id: string) => apiClient.post<LegalHold>(`/compliance/legal-holds/${id}/release`),

  // Audit export / verify
  createAuditExport: (input: CreateAuditExportInput) =>
    apiClient.post<AuditExport>("/compliance/audit/export", input),
  getAuditExport: (id: string) => apiClient.get<AuditExport>(`/compliance/audit/export/${id}`),
  verifyAuditChain: () => apiClient.get<AuditChainVerifyResult>("/compliance/audit/verify"),

  // Retention policies
  listRetentionPolicies: () => apiClient.get<RetentionPolicy[]>("/compliance/retention-policies"),
  createRetentionPolicy: (input: CreateRetentionPolicyInput) =>
    apiClient.post<RetentionPolicy>("/compliance/retention-policies", input),
  updateRetentionPolicy: (id: string, input: UpdateRetentionPolicyInput) =>
    apiClient.patch<RetentionPolicy>(`/compliance/retention-policies/${id}`, input),
  deleteRetentionPolicy: (id: string) =>
    apiClient.delete<{ message: string }>(`/compliance/retention-policies/${id}`),
};
