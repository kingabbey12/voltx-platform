import { MarketplaceRevenueShare } from '@prisma/client';

export interface MarketplaceRevenueShareEntity {
  id: string;
  appId: string;
  installId: string;
  purchaseAmountCents: number;
  platformFeeCents: number;
  developerPayoutCents: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId: string | null;
  createdAt: Date;
}

export const toMarketplaceRevenueShareEntity = (
  record: MarketplaceRevenueShare,
): MarketplaceRevenueShareEntity => ({
  id: record.id,
  appId: record.appId,
  installId: record.installId,
  purchaseAmountCents: record.purchaseAmountCents,
  platformFeeCents: record.platformFeeCents,
  developerPayoutCents: record.developerPayoutCents,
  stripeCheckoutSessionId: record.stripeCheckoutSessionId,
  stripePaymentIntentId: record.stripePaymentIntentId,
  createdAt: record.createdAt,
});
