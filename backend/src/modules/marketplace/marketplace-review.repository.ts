import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  MarketplaceReviewEntity,
  toMarketplaceReviewEntity,
} from './entities/marketplace-review.entity';

export interface CreateMarketplaceReviewData {
  appId: string;
  installId: string;
  installingOrganizationId: string;
  rating: number;
  comment?: string;
}

@Injectable()
export class MarketplaceReviewRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMarketplaceReviewData): Promise<MarketplaceReviewEntity> {
    const record = await this.prisma.system.marketplaceReview.create({ data });
    return toMarketplaceReviewEntity(record);
  }

  async findByAppAndOrganization(
    appId: string,
    installingOrganizationId: string,
  ): Promise<MarketplaceReviewEntity | null> {
    const record = await this.prisma.system.marketplaceReview.findUnique({
      where: { appId_installingOrganizationId: { appId, installingOrganizationId } },
    });
    return record ? toMarketplaceReviewEntity(record) : null;
  }

  async listForApp(appId: string): Promise<MarketplaceReviewEntity[]> {
    const records = await this.prisma.system.marketplaceReview.findMany({
      where: { appId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toMarketplaceReviewEntity);
  }

  async averageRatingForApp(appId: string): Promise<{ average: number; count: number }> {
    const result = await this.prisma.system.marketplaceReview.aggregate({
      where: { appId },
      _avg: { rating: true },
      _count: { rating: true },
    });
    return { average: result._avg.rating ?? 0, count: result._count.rating };
  }
}
