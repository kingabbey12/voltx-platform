import { PlatformAlert, PlatformAlertSeverity, PlatformAlertStatus } from '@prisma/client';

export interface PlatformAlertEntity {
  id: string;
  severity: PlatformAlertSeverity;
  category: string;
  status: PlatformAlertStatus;
  title: string;
  description: string | null;
  sourceMetadata: Record<string, unknown>;
  organizationId: string | null;
  acknowledgedById: string | null;
  acknowledgedAt: Date | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toPlatformAlertEntity = (record: PlatformAlert): PlatformAlertEntity => ({
  id: record.id,
  severity: record.severity,
  category: record.category,
  status: record.status,
  title: record.title,
  description: record.description,
  sourceMetadata: record.sourceMetadata as Record<string, unknown>,
  organizationId: record.organizationId,
  acknowledgedById: record.acknowledgedById,
  acknowledgedAt: record.acknowledgedAt,
  resolvedById: record.resolvedById,
  resolvedAt: record.resolvedAt,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
