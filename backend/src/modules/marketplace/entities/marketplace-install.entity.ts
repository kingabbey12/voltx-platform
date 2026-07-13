import { MarketplaceInstall, MarketplaceInstallStatus } from '@prisma/client';

export interface MarketplaceInstallEntity {
  id: string;
  appId: string;
  installingOrganizationId: string;
  installedVersionId: string;
  status: MarketplaceInstallStatus;
  installedByUserId: string;
  uninstalledAt: Date | null;
  createdAt: Date;
}

export const toMarketplaceInstallEntity = (
  record: MarketplaceInstall,
): MarketplaceInstallEntity => ({
  id: record.id,
  appId: record.appId,
  installingOrganizationId: record.installingOrganizationId,
  installedVersionId: record.installedVersionId,
  status: record.status,
  installedByUserId: record.installedByUserId,
  uninstalledAt: record.uninstalledAt,
  createdAt: record.createdAt,
});
