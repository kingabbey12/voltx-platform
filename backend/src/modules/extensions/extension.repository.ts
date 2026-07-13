import { Injectable } from '@nestjs/common';
import { ExtensionWidgetPlacement, MarketplaceInstallStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ExtensionAiToolEntity,
  ExtensionCustomNavEntryEntity,
  ExtensionCustomPageEntity,
  ExtensionCustomWidgetEntity,
  toExtensionAiToolEntity,
  toExtensionCustomNavEntryEntity,
  toExtensionCustomPageEntity,
  toExtensionCustomWidgetEntity,
} from './entities/extension.entity';

export interface CreatePageData {
  path: string;
  manifest: Prisma.InputJsonValue;
}

export interface CreateWidgetData {
  placement: ExtensionWidgetPlacement;
  manifest: Prisma.InputJsonValue;
}

export interface CreateNavEntryData {
  label: string;
  icon?: string;
  targetPath: string;
}

export interface CreateAiToolData {
  name: string;
  description: string;
  parametersSchema: Prisma.InputJsonValue;
  responseSchema: Prisma.InputJsonValue;
  endpointUrl: string;
  encryptedSigningSecret: string;
}

@Injectable()
export class ExtensionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPages(versionId: string, pages: CreatePageData[]): Promise<void> {
    if (pages.length === 0) {
      return;
    }
    await this.prisma.system.extensionCustomPage.createMany({
      data: pages.map((page) => ({ marketplaceAppVersionId: versionId, ...page })),
    });
  }

  async createWidgets(versionId: string, widgets: CreateWidgetData[]): Promise<void> {
    if (widgets.length === 0) {
      return;
    }
    await this.prisma.system.extensionCustomWidget.createMany({
      data: widgets.map((widget) => ({ marketplaceAppVersionId: versionId, ...widget })),
    });
  }

  async createNavEntries(versionId: string, navEntries: CreateNavEntryData[]): Promise<void> {
    if (navEntries.length === 0) {
      return;
    }
    await this.prisma.system.extensionCustomNavEntry.createMany({
      data: navEntries.map((entry) => ({ marketplaceAppVersionId: versionId, ...entry })),
    });
  }

  async createAiTools(versionId: string, aiTools: CreateAiToolData[]): Promise<void> {
    if (aiTools.length === 0) {
      return;
    }
    await this.prisma.system.extensionAiTool.createMany({
      data: aiTools.map((tool) => ({ marketplaceAppVersionId: versionId, ...tool })),
    });
  }

  /** Looks up the most recent prior materialization of a same-named AI
   * tool anywhere in this app's version history — lets a signing secret
   * survive a version bump instead of forcing the developer to
   * reconfigure their endpoint on every release. */
  async findPriorAiToolByName(appId: string, name: string): Promise<ExtensionAiToolEntity | null> {
    const record = await this.prisma.system.extensionAiTool.findFirst({
      where: { name, version: { appId } },
      orderBy: { createdAt: 'desc' },
    });
    return record ? toExtensionAiToolEntity(record) : null;
  }

  async listPagesForVersion(versionId: string): Promise<ExtensionCustomPageEntity[]> {
    const records = await this.prisma.system.extensionCustomPage.findMany({
      where: { marketplaceAppVersionId: versionId },
    });
    return records.map(toExtensionCustomPageEntity);
  }

  async listWidgetsForVersion(versionId: string): Promise<ExtensionCustomWidgetEntity[]> {
    const records = await this.prisma.system.extensionCustomWidget.findMany({
      where: { marketplaceAppVersionId: versionId },
    });
    return records.map(toExtensionCustomWidgetEntity);
  }

  async listNavEntriesForVersion(versionId: string): Promise<ExtensionCustomNavEntryEntity[]> {
    const records = await this.prisma.system.extensionCustomNavEntry.findMany({
      where: { marketplaceAppVersionId: versionId },
    });
    return records.map(toExtensionCustomNavEntryEntity);
  }

  async listAiToolsForVersion(versionId: string): Promise<ExtensionAiToolEntity[]> {
    const records = await this.prisma.system.extensionAiTool.findMany({
      where: { marketplaceAppVersionId: versionId },
    });
    return records.map(toExtensionAiToolEntity);
  }

  /** The version ids currently active for an installing organization —
   * shared by every "what does this org actually have installed"
   * lookup below. */
  private async activeInstalledVersionIds(organizationId: string): Promise<string[]> {
    const installs = await this.prisma.system.marketplaceInstall.findMany({
      where: { installingOrganizationId: organizationId, status: MarketplaceInstallStatus.ACTIVE },
      select: { installedVersionId: true },
    });
    return installs.map((install) => install.installedVersionId);
  }

  async listActivePagesForOrganization(
    organizationId: string,
  ): Promise<ExtensionCustomPageEntity[]> {
    const versionIds = await this.activeInstalledVersionIds(organizationId);
    if (versionIds.length === 0) {
      return [];
    }
    const records = await this.prisma.system.extensionCustomPage.findMany({
      where: { marketplaceAppVersionId: { in: versionIds } },
    });
    return records.map(toExtensionCustomPageEntity);
  }

  async listActiveWidgetsForOrganization(
    organizationId: string,
    placement?: ExtensionWidgetPlacement,
  ): Promise<ExtensionCustomWidgetEntity[]> {
    const versionIds = await this.activeInstalledVersionIds(organizationId);
    if (versionIds.length === 0) {
      return [];
    }
    const records = await this.prisma.system.extensionCustomWidget.findMany({
      where: {
        marketplaceAppVersionId: { in: versionIds },
        ...(placement ? { placement } : {}),
      },
    });
    return records.map(toExtensionCustomWidgetEntity);
  }

  async listActiveNavEntriesForOrganization(
    organizationId: string,
  ): Promise<ExtensionCustomNavEntryEntity[]> {
    const versionIds = await this.activeInstalledVersionIds(organizationId);
    if (versionIds.length === 0) {
      return [];
    }
    const records = await this.prisma.system.extensionCustomNavEntry.findMany({
      where: { marketplaceAppVersionId: { in: versionIds } },
    });
    return records.map(toExtensionCustomNavEntryEntity);
  }

  /** Paired with the owning appId — a tool `name` is only unique within
   * one app's own manifest, never globally, so any caller exposing these
   * across multiple installed apps (e.g. as AI runtime tool names) must
   * namespace by appId to avoid a same-named collision between two
   * unrelated developers' apps. */
  async listActiveAiToolsForOrganization(
    organizationId: string,
  ): Promise<{ appId: string; tool: ExtensionAiToolEntity }[]> {
    const installs = await this.prisma.system.marketplaceInstall.findMany({
      where: { installingOrganizationId: organizationId, status: MarketplaceInstallStatus.ACTIVE },
      select: {
        appId: true,
        installedVersion: { select: { aiTools: true } },
      },
    });

    return installs.flatMap((install) =>
      install.installedVersion.aiTools.map((tool) => ({
        appId: install.appId,
        tool: toExtensionAiToolEntity(tool),
      })),
    );
  }
}
