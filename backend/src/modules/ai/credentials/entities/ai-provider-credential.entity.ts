import { AIProviderName } from '../../models/ai-model.types';

export type AiProviderCredentialStatus = 'ACTIVE' | 'DISABLED';

/**
 * Domain entity for a stored, encrypted AI provider credential. `encryptedApiKey`
 * is the AES-256-GCM ciphertext — plaintext is only ever produced transiently
 * inside the resolver/tester and never stored on this entity.
 */
export interface AiProviderCredentialEntity {
  id: string;
  organizationId: string;
  provider: AIProviderName;
  label: string;
  encryptedApiKey: string;
  baseUrl: string | null;
  metadata: Record<string, unknown>;
  status: AiProviderCredentialStatus;
  lastRotatedAt: Date | null;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface AiProviderCredentialRecord {
  id: string;
  organizationId: string;
  provider: string;
  label: string;
  encryptedApiKey: string;
  baseUrl: string | null;
  metadata: unknown;
  status: AiProviderCredentialStatus;
  lastRotatedAt: Date | null;
  lastTestedAt: Date | null;
  lastTestStatus: string | null;
  lastTestError: string | null;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export function toAiProviderCredentialEntity(
  record: AiProviderCredentialRecord,
): AiProviderCredentialEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    provider: record.provider as AIProviderName,
    label: record.label,
    encryptedApiKey: record.encryptedApiKey,
    baseUrl: record.baseUrl,
    metadata:
      typeof record.metadata === 'object' &&
      record.metadata !== null &&
      !Array.isArray(record.metadata)
        ? (record.metadata as Record<string, unknown>)
        : {},
    status: record.status,
    lastRotatedAt: record.lastRotatedAt,
    lastTestedAt: record.lastTestedAt,
    lastTestStatus: record.lastTestStatus,
    lastTestError: record.lastTestError,
    createdByUserId: record.createdByUserId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    deletedAt: record.deletedAt,
  };
}
