import { PersonalAccessToken } from '@prisma/client';

export interface PersonalAccessTokenEntity {
  id: string;
  userId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  scopedPermissions: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export const toPersonalAccessTokenEntity = (
  record: PersonalAccessToken,
): PersonalAccessTokenEntity => ({
  id: record.id,
  userId: record.userId,
  name: record.name,
  tokenHash: record.tokenHash,
  tokenPrefix: record.tokenPrefix,
  scopedPermissions: record.scopedPermissions,
  expiresAt: record.expiresAt,
  lastUsedAt: record.lastUsedAt,
  revokedAt: record.revokedAt,
  createdAt: record.createdAt,
});
