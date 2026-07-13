import { ForbiddenException } from '@nestjs/common';
import { ExtensionInstalledService } from '../src/modules/extensions/extension-installed.service';
import { ExtensionRepository } from '../src/modules/extensions/extension.repository';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('ExtensionInstalledService', () => {
  let repository: jest.Mocked<ExtensionRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let service: ExtensionInstalledService;

  beforeEach(() => {
    repository = {
      listActivePagesForOrganization: jest.fn().mockResolvedValue([]),
      listActiveWidgetsForOrganization: jest.fn().mockResolvedValue([]),
      listActiveNavEntriesForOrganization: jest.fn().mockResolvedValue([]),
    } as never;
    tenantContextService = { assertOrganizationAccess: jest.fn() } as never;

    service = new ExtensionInstalledService(repository, tenantContextService);
  });

  it('enforces tenant access before reading', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(service.getInstalledForOrganization('org-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(repository.listActivePagesForOrganization).not.toHaveBeenCalled();
  });

  it('assembles pages, widgets, and nav entries for the organization', async () => {
    repository.listActivePagesForOrganization.mockResolvedValue([
      {
        id: 'page-1',
        marketplaceAppVersionId: 'v1',
        path: '/dashboard',
        manifest: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    repository.listActiveWidgetsForOrganization.mockResolvedValue([
      {
        id: 'widget-1',
        marketplaceAppVersionId: 'v1',
        placement: 'DASHBOARD',
        manifest: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    repository.listActiveNavEntriesForOrganization.mockResolvedValue([
      {
        id: 'nav-1',
        marketplaceAppVersionId: 'v1',
        label: 'My App',
        icon: null,
        targetPath: '/dashboard',
        createdAt: new Date(),
      },
    ]);

    const result = await service.getInstalledForOrganization('org-1');

    expect(result.pages).toHaveLength(1);
    expect(result.widgets).toHaveLength(1);
    expect(result.navEntries).toHaveLength(1);
    expect(result.navEntries[0].targetPath).toBe('/dashboard');
  });
});
