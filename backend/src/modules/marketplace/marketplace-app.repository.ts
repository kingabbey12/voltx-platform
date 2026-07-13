import { Injectable } from '@nestjs/common';
import { MarketplaceAppStatus, MarketplaceAppVersionStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  MarketplaceAppEntity,
  MarketplaceAppVersionEntity,
  toMarketplaceAppEntity,
  toMarketplaceAppVersionEntity,
} from './entities/marketplace-app.entity';

export interface CreateMarketplaceAppData {
  developerOrganizationId: string;
  name: string;
  description?: string;
  category: string;
  iconUrl?: string;
}

export interface UpdateMarketplaceAppData {
  name?: string;
  description?: string;
  category?: string;
  iconUrl?: string;
}

export interface CreateMarketplaceAppVersionData {
  appId: string;
  version: string;
  manifest: Prisma.InputJsonValue;
  changelog?: string;
  priceCents: number;
}

@Injectable()
export class MarketplaceAppRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMarketplaceAppData): Promise<MarketplaceAppEntity> {
    const record = await this.prisma.system.marketplaceApp.create({ data });
    return toMarketplaceAppEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<MarketplaceAppEntity[]> {
    const records = await this.prisma.system.marketplaceApp.findMany({
      where: { developerOrganizationId: organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toMarketplaceAppEntity);
  }

  async findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<MarketplaceAppEntity | null> {
    const record = await this.prisma.system.marketplaceApp.findFirst({
      where: { id, developerOrganizationId: organizationId },
    });
    return record ? toMarketplaceAppEntity(record) : null;
  }

  /** Unscoped — used by the public browse endpoints and the install flow,
   * neither of which is scoped to the app's owning (developer)
   * organization. */
  async findByIdUnscoped(id: string): Promise<MarketplaceAppEntity | null> {
    const record = await this.prisma.system.marketplaceApp.findUnique({ where: { id } });
    return record ? toMarketplaceAppEntity(record) : null;
  }

  async update(id: string, data: UpdateMarketplaceAppData): Promise<MarketplaceAppEntity> {
    const record = await this.prisma.system.marketplaceApp.update({ where: { id }, data });
    return toMarketplaceAppEntity(record);
  }

  async setStatus(id: string, status: MarketplaceAppStatus): Promise<MarketplaceAppEntity> {
    const record = await this.prisma.system.marketplaceApp.update({
      where: { id },
      data: { status },
    });
    return toMarketplaceAppEntity(record);
  }

  /** PUBLISHED apps only, optionally filtered by category/search — the
   * public marketplace listing. */
  async listPublished(params: {
    category?: string;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{ items: MarketplaceAppEntity[]; total: number }> {
    const where: Prisma.MarketplaceAppWhereInput = {
      status: MarketplaceAppStatus.PUBLISHED,
      ...(params.category ? { category: params.category } : {}),
      ...(params.search
        ? {
            OR: [
              { name: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.system.marketplaceApp.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prisma.system.marketplaceApp.count({ where }),
    ]);

    return { items: items.map(toMarketplaceAppEntity), total };
  }

  // --- Versions ---

  /** Every submitted version starts PENDING_REVIEW (not the schema's
   * DRAFT default) — a submission is, by definition, immediately awaiting
   * platform-admin review (see MarketplaceVersionReviewService). */
  async createVersion(data: CreateMarketplaceAppVersionData): Promise<MarketplaceAppVersionEntity> {
    const record = await this.prisma.system.marketplaceAppVersion.create({
      data: { ...data, status: MarketplaceAppVersionStatus.PENDING_REVIEW },
    });
    return toMarketplaceAppVersionEntity(record);
  }

  async listVersions(appId: string): Promise<MarketplaceAppVersionEntity[]> {
    const records = await this.prisma.system.marketplaceAppVersion.findMany({
      where: { appId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toMarketplaceAppVersionEntity);
  }

  async findVersionById(id: string): Promise<MarketplaceAppVersionEntity | null> {
    const record = await this.prisma.system.marketplaceAppVersion.findUnique({ where: { id } });
    return record ? toMarketplaceAppVersionEntity(record) : null;
  }

  async findVersionByIdForApp(
    id: string,
    appId: string,
  ): Promise<MarketplaceAppVersionEntity | null> {
    const record = await this.prisma.system.marketplaceAppVersion.findFirst({
      where: { id, appId },
    });
    return record ? toMarketplaceAppVersionEntity(record) : null;
  }

  /** The most recently approved version — what a fresh install resolves to. */
  async findLatestPublishedVersion(appId: string): Promise<MarketplaceAppVersionEntity | null> {
    const record = await this.prisma.system.marketplaceAppVersion.findFirst({
      where: { appId, status: MarketplaceAppVersionStatus.PUBLISHED },
      orderBy: { createdAt: 'desc' },
    });
    return record ? toMarketplaceAppVersionEntity(record) : null;
  }

  async listPendingReviewVersions(): Promise<MarketplaceAppVersionEntity[]> {
    const records = await this.prisma.system.marketplaceAppVersion.findMany({
      where: { status: MarketplaceAppVersionStatus.PENDING_REVIEW },
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toMarketplaceAppVersionEntity);
  }

  async approveVersion(id: string, reviewedByUserId: string): Promise<MarketplaceAppVersionEntity> {
    const record = await this.prisma.system.marketplaceAppVersion.update({
      where: { id },
      data: {
        status: MarketplaceAppVersionStatus.PUBLISHED,
        reviewedByUserId,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });
    return toMarketplaceAppVersionEntity(record);
  }

  async rejectVersion(
    id: string,
    reviewedByUserId: string,
    reason: string,
  ): Promise<MarketplaceAppVersionEntity> {
    const record = await this.prisma.system.marketplaceAppVersion.update({
      where: { id },
      data: {
        status: MarketplaceAppVersionStatus.REJECTED,
        reviewedByUserId,
        reviewedAt: new Date(),
        rejectionReason: reason,
      },
    });
    return toMarketplaceAppVersionEntity(record);
  }

  /** Whether this app has ever had a version reach PUBLISHED — decides
   * whether a new rejection should leave the app's own status alone
   * (already published on a prior good version) or revert it. */
  async hasEverPublishedVersion(appId: string): Promise<boolean> {
    const count = await this.prisma.system.marketplaceAppVersion.count({
      where: { appId, status: MarketplaceAppVersionStatus.PUBLISHED },
    });
    return count > 0;
  }
}
