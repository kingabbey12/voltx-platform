import { ScimToken, ScimTokenStatus } from '@prisma/client';

export interface ScimTokenEntity {
  id: string;
  organizationId: string;
  identityProviderId: string | null;
  name: string;
  tokenHash: string;
  status: ScimTokenStatus;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export function toScimTokenEntity(record: ScimToken): ScimTokenEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    identityProviderId: record.identityProviderId,
    name: record.name,
    tokenHash: record.tokenHash,
    status: record.status,
    expiresAt: record.expiresAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
