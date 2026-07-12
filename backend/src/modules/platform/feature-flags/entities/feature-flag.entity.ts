import { FeatureFlag, FeatureFlagType } from '@prisma/client';

export interface FeatureFlagEntity {
  id: string;
  key: string;
  name: string;
  description: string | null;
  type: FeatureFlagType;
  defaultValue: unknown;
  organizationOverrides: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const toFeatureFlagEntity = (record: FeatureFlag): FeatureFlagEntity => ({
  id: record.id,
  key: record.key,
  name: record.name,
  description: record.description,
  type: record.type,
  defaultValue: record.defaultValue,
  organizationOverrides: record.organizationOverrides as Record<string, unknown>,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
