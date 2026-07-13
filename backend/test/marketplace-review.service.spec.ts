import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceInstallStatus } from '@prisma/client';
import { MarketplaceReviewService } from '../src/modules/marketplace/marketplace-review.service';
import { MarketplaceReviewRepository } from '../src/modules/marketplace/marketplace-review.repository';
import { MarketplaceInstallRepository } from '../src/modules/marketplace/marketplace-install.repository';
import { MarketplaceAppRepository } from '../src/modules/marketplace/marketplace-app.repository';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('MarketplaceReviewService', () => {
  let reviewRepository: jest.Mocked<MarketplaceReviewRepository>;
  let installRepository: jest.Mocked<MarketplaceInstallRepository>;
  let appRepository: jest.Mocked<MarketplaceAppRepository>;
  let auditService: jest.Mocked<AuditService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let service: MarketplaceReviewService;

  beforeEach(() => {
    reviewRepository = {
      create: jest.fn(),
      findByAppAndOrganization: jest.fn(),
      listForApp: jest.fn(),
      averageRatingForApp: jest.fn(),
    } as never;
    installRepository = {
      findByAppAndOrganization: jest.fn(),
    } as never;
    appRepository = {
      findByIdUnscoped: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;
    tenantContextService = { assertOrganizationAccess: jest.fn() } as never;

    service = new MarketplaceReviewService(
      reviewRepository,
      installRepository,
      appRepository,
      auditService,
      tenantContextService,
    );
  });

  it('enforces tenant access before creating a review', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(service.create('app-1', 'org-1', { rating: 5 })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejects a review from an organization with no active install', async () => {
    installRepository.findByAppAndOrganization.mockResolvedValue(null);

    await expect(service.create('app-1', 'org-1', { rating: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a review from an organization whose install was uninstalled', async () => {
    installRepository.findByAppAndOrganization.mockResolvedValue({
      id: 'install-1',
      status: MarketplaceInstallStatus.UNINSTALLED,
    } as never);

    await expect(service.create('app-1', 'org-1', { rating: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects a second review from the same organization for the same app', async () => {
    installRepository.findByAppAndOrganization.mockResolvedValue({
      id: 'install-1',
      status: MarketplaceInstallStatus.ACTIVE,
    } as never);
    reviewRepository.findByAppAndOrganization.mockResolvedValue({ id: 'review-1' } as never);

    await expect(service.create('app-1', 'org-1', { rating: 5 })).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(reviewRepository.create).not.toHaveBeenCalled();
  });

  it('creates a review for an installed app with no prior review', async () => {
    installRepository.findByAppAndOrganization.mockResolvedValue({
      id: 'install-1',
      status: MarketplaceInstallStatus.ACTIVE,
    } as never);
    reviewRepository.findByAppAndOrganization.mockResolvedValue(null);
    reviewRepository.create.mockResolvedValue({
      id: 'review-1',
      appId: 'app-1',
      rating: 5,
      comment: null,
      createdAt: new Date(),
    } as never);

    const result = await service.create('app-1', 'org-1', { rating: 5 });

    expect(reviewRepository.create).toHaveBeenCalledWith({
      appId: 'app-1',
      installId: 'install-1',
      installingOrganizationId: 'org-1',
      rating: 5,
      comment: undefined,
    });
    expect(result.id).toBe('review-1');
  });

  it('404s listing reviews for an app that does not exist', async () => {
    appRepository.findByIdUnscoped.mockResolvedValue(null);

    await expect(service.listForApp('app-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
