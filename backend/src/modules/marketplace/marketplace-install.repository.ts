import { Injectable } from '@nestjs/common';
import { MarketplaceInstallStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  MarketplaceInstallEntity,
  toMarketplaceInstallEntity,
} from './entities/marketplace-install.entity';

export interface CreateMarketplaceInstallData {
  appId: string;
  installingOrganizationId: string;
  installedVersionId: string;
  installedByUserId: string;
}

@Injectable()
export class MarketplaceInstallRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateMarketplaceInstallData): Promise<MarketplaceInstallEntity> {
    const record = await this.prisma.system.marketplaceInstall.create({ data });
    return toMarketplaceInstallEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<MarketplaceInstallEntity[]> {
    const records = await this.prisma.system.marketplaceInstall.findMany({
      where: { installingOrganizationId: organizationId, status: MarketplaceInstallStatus.ACTIVE },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toMarketplaceInstallEntity);
  }

  async findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<MarketplaceInstallEntity | null> {
    const record = await this.prisma.system.marketplaceInstall.findFirst({
      where: { id, installingOrganizationId: organizationId },
    });
    return record ? toMarketplaceInstallEntity(record) : null;
  }

  async findByAppAndOrganization(
    appId: string,
    organizationId: string,
  ): Promise<MarketplaceInstallEntity | null> {
    const record = await this.prisma.system.marketplaceInstall.findUnique({
      where: {
        appId_installingOrganizationId: { appId, installingOrganizationId: organizationId },
      },
    });
    return record ? toMarketplaceInstallEntity(record) : null;
  }

  async uninstall(id: string): Promise<void> {
    await this.prisma.system.marketplaceInstall.update({
      where: { id },
      data: { status: MarketplaceInstallStatus.UNINSTALLED, uninstalledAt: new Date() },
    });
  }

  /** A previously-uninstalled app reinstalling hits the same
   * (appId, installingOrganizationId) unique row rather than creating a
   * new one — this flips it back to ACTIVE against the (possibly newer)
   * version instead. */
  async reactivate(
    id: string,
    installedVersionId: string,
    installedByUserId: string,
  ): Promise<MarketplaceInstallEntity> {
    const record = await this.prisma.system.marketplaceInstall.update({
      where: { id },
      data: {
        status: MarketplaceInstallStatus.ACTIVE,
        installedVersionId,
        installedByUserId,
        uninstalledAt: null,
      },
    });
    return toMarketplaceInstallEntity(record);
  }
}
