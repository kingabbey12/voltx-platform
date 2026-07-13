import { apiClient } from "./client";

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export interface SecurityPolicy {
  mfaRequired: boolean;
  passwordPolicy: PasswordPolicy;
  ipAllowlist: string[];
}

export interface UpdateSecurityPolicyInput {
  mfaRequired?: boolean;
  passwordPolicy?: Partial<PasswordPolicy>;
  ipAllowlist?: string[];
}

export interface Session {
  id: string;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: string;
  createdAt: string;
  revokedAt: string | null;
}

export interface PaginatedSessions {
  items: Session[];
  total: number;
  page: number;
  limit: number;
}

export interface TrustedDevice {
  id: string;
  label: string | null;
  trustedUntil: string;
  lastSeenAt: string;
}

export interface ApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  scopedPermissions: string[];
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface CreateApiKeyInput {
  name: string;
  scopedPermissions: string[];
  expiresAt?: string;
}

export interface CreateApiKeyResult extends ApiKey {
  apiKey: string;
}

export interface MfaSetupResult {
  secret: string;
  otpauthUrl: string;
}

export interface MfaBackupCodesResult {
  backupCodes: string[];
}

export const securityApi = {
  // Policy — org-scoped
  getPolicy: (organizationId: string) =>
    apiClient.get<SecurityPolicy>(`/organizations/${organizationId}/security-policy`),
  updatePolicy: (organizationId: string, input: UpdateSecurityPolicyInput) =>
    apiClient.patch<SecurityPolicy>(`/organizations/${organizationId}/security-policy`, input),

  // Sessions — user-scoped within current org
  listSessions: () => apiClient.get<Session[]>("/security/sessions"),
  revokeSession: (id: string) => apiClient.delete<{ message: string }>(`/security/sessions/${id}`),
  loginHistory: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedSessions>("/security/login-history", { query: { ...params } }),

  // Trusted devices — user-scoped
  listTrustedDevices: () => apiClient.get<TrustedDevice[]>("/security/trusted-devices"),
  revokeTrustedDevice: (id: string) =>
    apiClient.delete<{ message: string }>(`/security/trusted-devices/${id}`),

  // API keys — org-scoped
  listApiKeys: () => apiClient.get<ApiKey[]>("/security/api-keys"),
  createApiKey: (input: CreateApiKeyInput) =>
    apiClient.post<CreateApiKeyResult>("/security/api-keys", input),
  revokeApiKey: (id: string) => apiClient.delete<{ message: string }>(`/security/api-keys/${id}`),

  // MFA — user-scoped
  setupMfa: () => apiClient.post<MfaSetupResult>("/security/mfa/setup"),
  verifyMfaSetup: (code: string) =>
    apiClient.post<MfaBackupCodesResult>("/security/mfa/setup/verify", { code }),
  disableMfa: (code: string) =>
    apiClient.post<{ message: string }>("/security/mfa/disable", { code }),
  regenerateBackupCodes: (code: string) =>
    apiClient.post<MfaBackupCodesResult>("/security/mfa/backup-codes/regenerate", { code }),
};
