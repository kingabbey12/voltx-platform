import { SupportSession, SupportSessionStatus } from '@prisma/client';

export interface SupportSessionEntity {
  id: string;
  platformAdminUserId: string;
  targetOrganizationId: string;
  reason: string;
  status: SupportSessionStatus;
  supportMembershipId: string | null;
  expiresAt: Date;
  endedAt: Date | null;
  endedById: string | null;
  createdAt: Date;
}

export const toSupportSessionEntity = (record: SupportSession): SupportSessionEntity => ({
  id: record.id,
  platformAdminUserId: record.platformAdminUserId,
  targetOrganizationId: record.targetOrganizationId,
  reason: record.reason,
  status: record.status,
  supportMembershipId: record.supportMembershipId,
  expiresAt: record.expiresAt,
  endedAt: record.endedAt,
  endedById: record.endedById,
  createdAt: record.createdAt,
});
