import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  MarketplaceRevenueShareEntity,
  toMarketplaceRevenueShareEntity,
} from './entities/marketplace-revenue-share.entity';

export interface CreateMarketplaceRevenueShareData {
  appId: string;
  installId: string;
  purchaseAmountCents: number;
  platformFeeCents: number;
  developerPayoutCents: number;
  stripeCheckoutSessionId: string;
  stripePaymentIntentId?: string;
}

@Injectable()
export class MarketplaceRevenueShareRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent — Stripe may redeliver `checkout.session.completed`, and
   * `stripeCheckoutSessionId` is unique, so a redelivery is a no-op rather
   * than double-recording revenue. */
  async createIfNew(
    data: CreateMarketplaceRevenueShareData,
  ): Promise<{ entity: MarketplaceRevenueShareEntity; isNew: boolean }> {
    const existing = await this.prisma.system.marketplaceRevenueShare.findUnique({
      where: { stripeCheckoutSessionId: data.stripeCheckoutSessionId },
    });
    if (existing) {
      return { entity: toMarketplaceRevenueShareEntity(existing), isNew: false };
    }

    const record = await this.prisma.system.marketplaceRevenueShare.create({ data });
    return { entity: toMarketplaceRevenueShareEntity(record), isNew: true };
  }

  async findByCheckoutSessionId(
    stripeCheckoutSessionId: string,
  ): Promise<MarketplaceRevenueShareEntity | null> {
    const record = await this.prisma.system.marketplaceRevenueShare.findUnique({
      where: { stripeCheckoutSessionId },
    });
    return record ? toMarketplaceRevenueShareEntity(record) : null;
  }
}
