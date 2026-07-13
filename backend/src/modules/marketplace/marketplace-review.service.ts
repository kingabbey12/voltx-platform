import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceInstallStatus } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateMarketplaceReviewDto,
  MarketplaceReviewResponseDto,
} from './dto/marketplace-review.dto';
import { MarketplaceAppRepository } from './marketplace-app.repository';
import { MarketplaceInstallRepository } from './marketplace-install.repository';
import { MarketplaceReviewRepository } from './marketplace-review.repository';

/** One review per installing organization per app — enforced both by the
 * `@@unique([appId, installingOrganizationId])` constraint and this
 * explicit pre-check (for a clean 400 instead of a raw Prisma error). A
 * review requires an active install, so only real users of the app can
 * rate it. */
@Injectable()
export class MarketplaceReviewService {
  constructor(
    private readonly reviewRepository: MarketplaceReviewRepository,
    private readonly installRepository: MarketplaceInstallRepository,
    private readonly appRepository: MarketplaceAppRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async listForApp(appId: string): Promise<MarketplaceReviewResponseDto[]> {
    const app = await this.appRepository.findByIdUnscoped(appId);
    if (!app) {
      throw new NotFoundException('Marketplace app not found');
    }
    const reviews = await this.reviewRepository.listForApp(appId);
    return reviews.map((review) => MarketplaceReviewResponseDto.fromEntity(review));
  }

  async create(
    appId: string,
    organizationId: string,
    dto: CreateMarketplaceReviewDto,
  ): Promise<MarketplaceReviewResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const install = await this.installRepository.findByAppAndOrganization(appId, organizationId);
    if (!install || install.status !== MarketplaceInstallStatus.ACTIVE) {
      throw new BadRequestException('You must have this app installed to review it');
    }

    const existingReview = await this.reviewRepository.findByAppAndOrganization(
      appId,
      organizationId,
    );
    if (existingReview) {
      throw new BadRequestException('This organization has already reviewed this app');
    }

    const entity = await this.reviewRepository.create({
      appId,
      installId: install.id,
      installingOrganizationId: organizationId,
      rating: dto.rating,
      comment: dto.comment,
    });

    await this.auditService.record({
      action: 'marketplace_review.created',
      resource: 'marketplace_review',
      resourceId: entity.id,
      metadata: { appId, rating: dto.rating },
    });

    return MarketplaceReviewResponseDto.fromEntity(entity);
  }
}
