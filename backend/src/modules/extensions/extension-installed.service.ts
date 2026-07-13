import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  ExtensionNavEntryResponseDto,
  ExtensionPageResponseDto,
  ExtensionWidgetResponseDto,
  InstalledExtensionsResponseDto,
} from './dto/extension.dto';
import { ExtensionRepository } from './extension.repository';

/** What an installing organization's own web app renders — everything
 * scoped to that organization's currently ACTIVE installs only. */
@Injectable()
export class ExtensionInstalledService {
  constructor(
    private readonly repository: ExtensionRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async getInstalledForOrganization(
    organizationId: string,
  ): Promise<InstalledExtensionsResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);

    const [pages, widgets, navEntries] = await Promise.all([
      this.repository.listActivePagesForOrganization(organizationId),
      this.repository.listActiveWidgetsForOrganization(organizationId),
      this.repository.listActiveNavEntriesForOrganization(organizationId),
    ]);

    const dto = new InstalledExtensionsResponseDto();
    dto.pages = pages.map((page) => ExtensionPageResponseDto.fromEntity(page));
    dto.widgets = widgets.map((widget) => ExtensionWidgetResponseDto.fromEntity(widget));
    dto.navEntries = navEntries.map((entry) => ExtensionNavEntryResponseDto.fromEntity(entry));
    return dto;
  }
}
