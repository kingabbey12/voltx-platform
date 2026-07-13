import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MarketplaceAppStatus, Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateMarketplaceAppDto,
  CreateMarketplaceAppVersionDto,
  MarketplaceAppResponseDto,
  MarketplaceAppVersionResponseDto,
  UpdateMarketplaceAppDto,
} from './dto/marketplace-app.dto';
import { MarketplaceAppRepository } from './marketplace-app.repository';

@Injectable()
export class MarketplaceAppService {
  constructor(
    private readonly repository: MarketplaceAppRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateMarketplaceAppDto,
  ): Promise<MarketplaceAppResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const entity = await this.repository.create({
      developerOrganizationId: organizationId,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      iconUrl: dto.iconUrl,
    });

    await this.auditService.record({
      action: 'marketplace_app.created',
      resource: 'marketplace_app',
      resourceId: entity.id,
      metadata: { name: dto.name, category: dto.category },
    });

    return MarketplaceAppResponseDto.fromEntity(entity);
  }

  async list(organizationId: string): Promise<MarketplaceAppResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entities = await this.repository.listByOrganization(organizationId);
    return entities.map((entity) => MarketplaceAppResponseDto.fromEntity(entity));
  }

  async getOrThrow(id: string, organizationId: string): Promise<MarketplaceAppResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.findOwnedOrThrow(id, organizationId);
    return MarketplaceAppResponseDto.fromEntity(entity);
  }

  async update(
    id: string,
    organizationId: string,
    dto: UpdateMarketplaceAppDto,
  ): Promise<MarketplaceAppResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);

    const entity = await this.repository.update(id, dto);
    await this.auditService.record({
      action: 'marketplace_app.updated',
      resource: 'marketplace_app',
      resourceId: id,
    });

    return MarketplaceAppResponseDto.fromEntity(entity);
  }

  async createVersion(
    id: string,
    organizationId: string,
    dto: CreateMarketplaceAppVersionDto,
  ): Promise<MarketplaceAppVersionResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const app = await this.findOwnedOrThrow(id, organizationId);

    if (app.status === MarketplaceAppStatus.SUSPENDED) {
      throw new ForbiddenException('A suspended app cannot submit new versions');
    }

    const existingVersions = await this.repository.listVersions(id);
    if (existingVersions.some((existing) => existing.version === dto.version)) {
      throw new BadRequestException(
        `Version "${dto.version}" has already been submitted for this app`,
      );
    }

    const entity = await this.repository.createVersion({
      appId: id,
      version: dto.version,
      manifest: dto.manifest as Prisma.InputJsonValue,
      changelog: dto.changelog,
      priceCents: dto.priceCents ?? 0,
    });

    // The app itself moves to PENDING_REVIEW so it surfaces in the
    // platform-admin review queue; an already-published app stays
    // PUBLISHED on its last approved version while the new one awaits
    // review (see MarketplaceVersionReviewService for the approve/reject
    // side of this state machine).
    if (app.status === MarketplaceAppStatus.DRAFT) {
      await this.repository.setStatus(id, MarketplaceAppStatus.PENDING_REVIEW);
    }

    await this.auditService.record({
      action: 'marketplace_app.version_submitted',
      resource: 'marketplace_app',
      resourceId: id,
      metadata: { versionId: entity.id, version: dto.version, priceCents: entity.priceCents },
    });

    return MarketplaceAppVersionResponseDto.fromEntity(entity);
  }

  async listVersions(
    id: string,
    organizationId: string,
  ): Promise<MarketplaceAppVersionResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.findOwnedOrThrow(id, organizationId);
    const versions = await this.repository.listVersions(id);
    return versions.map((version) => MarketplaceAppVersionResponseDto.fromEntity(version));
  }

  private async findOwnedOrThrow(id: string, organizationId: string) {
    const entity = await this.repository.findByIdInOrganization(id, organizationId);
    if (!entity) {
      throw new NotFoundException('Marketplace app not found');
    }
    return entity;
  }
}
