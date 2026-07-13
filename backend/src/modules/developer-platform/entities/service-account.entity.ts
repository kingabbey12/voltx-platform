import { ServiceAccount, ServiceAccountStatus, ServiceAccountToken } from '@prisma/client';

export interface ServiceAccountEntity {
  id: string;
  organizationId: string;
  userId: string;
  name: string;
  description: string | null;
  status: ServiceAccountStatus;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toServiceAccountEntity = (record: ServiceAccount): ServiceAccountEntity => ({
  id: record.id,
  organizationId: record.organizationId,
  userId: record.userId,
  name: record.name,
  description: record.description,
  status: record.status,
  createdByUserId: record.createdByUserId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export interface ServiceAccountTokenEntity {
  id: string;
  serviceAccountId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export const toServiceAccountTokenEntity = (
  record: ServiceAccountToken,
): ServiceAccountTokenEntity => ({
  id: record.id,
  serviceAccountId: record.serviceAccountId,
  name: record.name,
  tokenHash: record.tokenHash,
  tokenPrefix: record.tokenPrefix,
  expiresAt: record.expiresAt,
  lastUsedAt: record.lastUsedAt,
  revokedAt: record.revokedAt,
  createdAt: record.createdAt,
});
