import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { MarketplaceAppStatus } from '@prisma/client';
import { MarketplaceAppRepository } from '../marketplace/marketplace-app.repository';
import { MarketplaceInstallService } from '../marketplace/marketplace-install.service';
import { MarketplaceInstallRepository } from '../marketplace/marketplace-install.repository';
import {
  InstallPluginDto,
  InstalledPluginDto,
  PluginManifestResponseDto,
  PluginRegistryItemDto,
  PluginRegistryResponseDto,
} from './dto/plugin.dto';

@Injectable()
export class PluginService {
  constructor(
    private readonly tenantContextService: TenantContextService,
    private readonly appRepository: MarketplaceAppRepository,
    private readonly installRepository: MarketplaceInstallRepository,
    private readonly installService: MarketplaceInstallService,
  ) {}

  async listRegistry(params: {
    organizationId: string;
    page: number;
    limit: number;
    category?: string;
    search?: string;
  }): Promise<PluginRegistryResponseDto> {
    this.tenantContextService.assertOrganizationAccess(params.organizationId);

    const [{ items, total }, installs] = await Promise.all([
      this.appRepository.listPublished({
        page: params.page,
        limit: params.limit,
        category: params.category,
        search: params.search,
      }),
      this.installRepository.listByOrganization(params.organizationId),
    ]);

    const installedAppIds = new Set(installs.map((install) => install.appId));

    const mapped = await Promise.all(
      items.map(async (app) => {
        const latestVersion = await this.appRepository.findLatestPublishedVersion(app.id);
        const dto = new PluginRegistryItemDto();
        dto.pluginId = app.id;
        dto.name = app.name;
        dto.description = app.description;
        dto.category = app.category;
        dto.iconUrl = app.iconUrl;
        dto.latestVersion = latestVersion?.version ?? null;
        dto.priceCents = latestVersion?.priceCents ?? null;
        dto.isInstalled = installedAppIds.has(app.id);
        return dto;
      }),
    );

    const response = new PluginRegistryResponseDto();
    response.items = mapped;
    response.total = total;
    response.page = params.page;
    response.limit = params.limit;
    return response;
  }

  async listInstalled(organizationId: string): Promise<InstalledPluginDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const installs = await this.installRepository.listByOrganization(organizationId);

    const entries = await Promise.all(
      installs.map(async (install) => {
        const [app, version] = await Promise.all([
          this.appRepository.findByIdUnscoped(install.appId),
          this.appRepository.findVersionById(install.installedVersionId),
        ]);

        const dto = new InstalledPluginDto();
        dto.installId = install.id;
        dto.pluginId = install.appId;
        dto.name = app?.name ?? 'Unknown plugin';
        dto.description = app?.description ?? null;
        dto.status = install.status;
        dto.installedVersionId = install.installedVersionId;
        dto.installedVersion = version?.version ?? null;
        dto.createdAt = install.createdAt.toISOString();
        return dto;
      }),
    );

    return entries;
  }

  async getManifest(
    organizationId: string,
    pluginId: string,
  ): Promise<PluginManifestResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const app = await this.appRepository.findByIdUnscoped(pluginId);
    if (!app || app.status !== MarketplaceAppStatus.PUBLISHED) {
      throw new NotFoundException('Plugin not found');
    }

    const latestVersion = await this.appRepository.findLatestPublishedVersion(pluginId);
    if (!latestVersion) {
      throw new NotFoundException('Plugin has no published manifest');
    }

    const dto = new PluginManifestResponseDto();
    dto.pluginId = pluginId;
    dto.versionId = latestVersion.id;
    dto.version = latestVersion.version;
    dto.manifest =
      typeof latestVersion.manifest === 'object' && latestVersion.manifest !== null
        ? (latestVersion.manifest as Record<string, unknown>)
        : {};
    return dto;
  }

  install(
    organizationId: string,
    pluginId: string,
    userId: string,
    dto: InstallPluginDto,
  ) {
    return this.installService.install(organizationId, pluginId, userId, dto);
  }

  uninstall(organizationId: string, installId: string): Promise<void> {
    return this.installService.uninstall(installId, organizationId);
  }
}
