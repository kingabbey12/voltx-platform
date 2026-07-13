import { Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceAppStatus } from '@prisma/client';
import {
  PublicMarketplaceAppListResponseDto,
  PublicMarketplaceAppSummaryDto,
} from './dto/marketplace-public.dto';
import { MarketplaceAppRepository } from './marketplace-app.repository';
import { MarketplaceReviewRepository } from './marketplace-review.repository';

/** Unauthenticated browse/search — mirrors BrandingPublicController's
 * zero-guard convention, since a prospective installer should be able to
 * browse the marketplace before signing in. */
@Injectable()
export class MarketplacePublicService {
  constructor(
    private readonly appRepository: MarketplaceAppRepository,
    private readonly reviewRepository: MarketplaceReviewRepository,
  ) {}

  async list(params: {
    category?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<PublicMarketplaceAppListResponseDto> {
    const { items, total } = await this.appRepository.listPublished(params);

    const summaries = await Promise.all(
      items.map(async (app) => {
        const [latestVersion, rating] = await Promise.all([
          this.appRepository.findLatestPublishedVersion(app.id),
          this.reviewRepository.averageRatingForApp(app.id),
        ]);
        return PublicMarketplaceAppSummaryDto.fromEntity(app, latestVersion, rating);
      }),
    );

    const dto = new PublicMarketplaceAppListResponseDto();
    dto.items = summaries;
    dto.total = total;
    dto.page = params.page;
    dto.limit = params.limit;
    return dto;
  }

  async getOrThrow(appId: string): Promise<PublicMarketplaceAppSummaryDto> {
    const app = await this.appRepository.findByIdUnscoped(appId);
    if (!app || app.status !== MarketplaceAppStatus.PUBLISHED) {
      throw new NotFoundException('Marketplace app not found');
    }

    const [latestVersion, rating] = await Promise.all([
      this.appRepository.findLatestPublishedVersion(appId),
      this.reviewRepository.averageRatingForApp(appId),
    ]);

    return PublicMarketplaceAppSummaryDto.fromEntity(app, latestVersion, rating);
  }
}
