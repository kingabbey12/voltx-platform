import { MarketplaceReview } from '@prisma/client';

export interface MarketplaceReviewEntity {
  id: string;
  appId: string;
  installId: string;
  installingOrganizationId: string;
  rating: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const toMarketplaceReviewEntity = (record: MarketplaceReview): MarketplaceReviewEntity => ({
  id: record.id,
  appId: record.appId,
  installId: record.installId,
  installingOrganizationId: record.installingOrganizationId,
  rating: record.rating,
  comment: record.comment,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
});
