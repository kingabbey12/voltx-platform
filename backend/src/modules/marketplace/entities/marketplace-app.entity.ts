import {
  MarketplaceApp,
  MarketplaceAppStatus,
  MarketplaceAppVersion,
  MarketplaceAppVersionStatus,
  Prisma,
} from '@prisma/client';

export interface MarketplaceAppEntity {
  id: string;
  developerOrganizationId: string;
  name: string;
  description: string | null;
  category: string;
  iconUrl: string | null;
  status: MarketplaceAppStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const toMarketplaceAppEntity = (record: MarketplaceApp): MarketplaceAppEntity => ({
  id: record.id,
  developerOrganizationId: record.developerOrganizationId,
  name: record.name,
  description: record.description,
  category: record.category,
  iconUrl: record.iconUrl,
  status: record.status,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});

export interface MarketplaceAppVersionEntity {
  id: string;
  appId: string;
  version: string;
  manifest: Prisma.JsonValue;
  changelog: string | null;
  priceCents: number;
  status: MarketplaceAppVersionStatus;
  reviewedByUserId: string | null;
  reviewedAt: Date | null;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toMarketplaceAppVersionEntity = (
  record: MarketplaceAppVersion,
): MarketplaceAppVersionEntity => ({
  id: record.id,
  appId: record.appId,
  version: record.version,
  manifest: record.manifest,
  changelog: record.changelog,
  priceCents: record.priceCents,
  status: record.status,
  reviewedByUserId: record.reviewedByUserId,
  reviewedAt: record.reviewedAt,
  rejectionReason: record.rejectionReason,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
