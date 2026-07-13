import { NotFoundException } from '@nestjs/common';
import { MarketplaceAppStatus } from '@prisma/client';
import { MarketplacePublicService } from '../src/modules/marketplace/marketplace-public.service';
import { MarketplaceAppRepository } from '../src/modules/marketplace/marketplace-app.repository';
import { MarketplaceReviewRepository } from '../src/modules/marketplace/marketplace-review.repository';

describe('MarketplacePublicService', () => {
  let appRepository: jest.Mocked<MarketplaceAppRepository>;
  let reviewRepository: jest.Mocked<MarketplaceReviewRepository>;
  let service: MarketplacePublicService;

  const publishedApp = {
    id: 'app-1',
    name: 'Acme Reporting',
    description: null,
    category: 'ANALYTICS',
    iconUrl: null,
    status: MarketplaceAppStatus.PUBLISHED,
    createdAt: new Date(),
  };

  beforeEach(() => {
    appRepository = {
      listPublished: jest.fn(),
      findLatestPublishedVersion: jest.fn(),
      findByIdUnscoped: jest.fn(),
    } as never;
    reviewRepository = {
      averageRatingForApp: jest.fn(),
    } as never;

    service = new MarketplacePublicService(appRepository, reviewRepository);
  });

  describe('getOrThrow', () => {
    it('404s an app that does not exist', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(null);

      await expect(service.getOrThrow('app-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s an app that exists but is not published (a developer-only draft)', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue({
        ...publishedApp,
        status: MarketplaceAppStatus.DRAFT,
      } as never);

      await expect(service.getOrThrow('app-1')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns a published app with its latest version and rating', async () => {
      appRepository.findByIdUnscoped.mockResolvedValue(publishedApp as never);
      appRepository.findLatestPublishedVersion.mockResolvedValue({
        version: '2.0.0',
        priceCents: 500,
      } as never);
      reviewRepository.averageRatingForApp.mockResolvedValue({ average: 4.5, count: 10 });

      const result = await service.getOrThrow('app-1');

      expect(result.latestVersion).toBe('2.0.0');
      expect(result.priceCents).toBe(500);
      expect(result.averageRating).toBe(4.5);
      expect(result.reviewCount).toBe(10);
    });
  });

  describe('list', () => {
    it('assembles summaries with per-app rating and latest version', async () => {
      appRepository.listPublished.mockResolvedValue({ items: [publishedApp as never], total: 1 });
      appRepository.findLatestPublishedVersion.mockResolvedValue({
        version: '1.0.0',
        priceCents: 0,
      } as never);
      reviewRepository.averageRatingForApp.mockResolvedValue({ average: 0, count: 0 });

      const result = await service.list({ page: 1, limit: 20 });

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('app-1');
    });
  });
});
