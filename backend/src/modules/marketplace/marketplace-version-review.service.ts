import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MarketplaceAppStatus, MarketplaceAppVersionStatus } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import {
  MarketplaceAppVersionResponseDto,
  RejectMarketplaceAppVersionDto,
} from './dto/marketplace-app.dto';
import { MarketplaceAppRepository } from './marketplace-app.repository';

/**
 * Platform-admin-only review queue for submitted app versions — mirrors
 * v2.2 Platform Console's own admin-approval conventions (guarded by
 * PLATFORM_ADMIN_GUARDS at the controller, not any org-scoped permission,
 * since a platform admin reviews every organization's submissions).
 */
@Injectable()
export class MarketplaceVersionReviewService {
  constructor(
    private readonly repository: MarketplaceAppRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPending(): Promise<MarketplaceAppVersionResponseDto[]> {
    const versions = await this.repository.listPendingReviewVersions();
    return versions.map((version) => MarketplaceAppVersionResponseDto.fromEntity(version));
  }

  async approve(
    versionId: string,
    reviewerUserId: string,
  ): Promise<MarketplaceAppVersionResponseDto> {
    const version = await this.findPendingOrThrow(versionId);

    const approved = await this.repository.approveVersion(versionId, reviewerUserId);
    await this.repository.setStatus(version.appId, MarketplaceAppStatus.PUBLISHED);

    await this.auditService.recordWithExplicitActor({
      organizationId: (await this.appOrganizationId(version.appId)) ?? version.appId,
      userId: reviewerUserId,
      action: 'marketplace_app_version.approved',
      resource: 'marketplace_app_version',
      resourceId: versionId,
    });

    return MarketplaceAppVersionResponseDto.fromEntity(approved);
  }

  async reject(
    versionId: string,
    reviewerUserId: string,
    dto: RejectMarketplaceAppVersionDto,
  ): Promise<MarketplaceAppVersionResponseDto> {
    const version = await this.findPendingOrThrow(versionId);

    const rejected = await this.repository.rejectVersion(versionId, reviewerUserId, dto.reason);

    // A never-before-published app has no good version to fall back to,
    // so it stays visible in the developer's own dashboard as
    // PENDING_REVIEW-turned-rejected context; an app that was already
    // published before is untouched — it keeps serving its last approved
    // version regardless of this new rejection.
    const alreadyPublished = await this.repository.hasEverPublishedVersion(version.appId);
    if (!alreadyPublished) {
      await this.repository.setStatus(version.appId, MarketplaceAppStatus.DRAFT);
    }

    await this.auditService.recordWithExplicitActor({
      organizationId: (await this.appOrganizationId(version.appId)) ?? version.appId,
      userId: reviewerUserId,
      action: 'marketplace_app_version.rejected',
      resource: 'marketplace_app_version',
      resourceId: versionId,
      metadata: { reason: dto.reason },
    });

    return MarketplaceAppVersionResponseDto.fromEntity(rejected);
  }

  private async findPendingOrThrow(versionId: string) {
    const version = await this.repository.findVersionById(versionId);
    if (!version) {
      throw new NotFoundException('Marketplace app version not found');
    }
    if (version.status !== MarketplaceAppVersionStatus.PENDING_REVIEW) {
      throw new BadRequestException('This version is not pending review');
    }
    return version;
  }

  private async appOrganizationId(appId: string): Promise<string | null> {
    const app = await this.repository.findByIdUnscoped(appId);
    return app?.developerOrganizationId ?? null;
  }
}
