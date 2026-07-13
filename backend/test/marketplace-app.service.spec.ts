import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { MarketplaceAppStatus } from '@prisma/client';
import { MarketplaceAppService } from '../src/modules/marketplace/marketplace-app.service';
import { MarketplaceAppRepository } from '../src/modules/marketplace/marketplace-app.repository';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

describe('MarketplaceAppService', () => {
  let repository: jest.Mocked<MarketplaceAppRepository>;
  let auditService: jest.Mocked<AuditService>;
  let tenantContextService: jest.Mocked<TenantContextService>;
  let service: MarketplaceAppService;

  const app = {
    id: 'app-1',
    developerOrganizationId: 'org-1',
    name: 'Acme Reporting',
    description: null,
    category: 'ANALYTICS',
    iconUrl: null,
    status: MarketplaceAppStatus.DRAFT,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      listByOrganization: jest.fn(),
      findByIdInOrganization: jest.fn(),
      findByIdUnscoped: jest.fn(),
      update: jest.fn(),
      setStatus: jest.fn(),
      listPublished: jest.fn(),
      createVersion: jest.fn(),
      listVersions: jest.fn(),
      findVersionById: jest.fn(),
      findVersionByIdForApp: jest.fn(),
      findLatestPublishedVersion: jest.fn(),
      listPendingReviewVersions: jest.fn(),
      approveVersion: jest.fn(),
      rejectVersion: jest.fn(),
      hasEverPublishedVersion: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;
    tenantContextService = { assertOrganizationAccess: jest.fn() } as never;

    service = new MarketplaceAppService(repository, auditService, tenantContextService);
  });

  it('enforces tenant access on every entry point', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(
      service.create('org-1', { name: 'x', category: 'ANALYTICS' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('404s when acting on an app the organization does not own', async () => {
    repository.findByIdInOrganization.mockResolvedValue(null);

    await expect(service.getOrThrow('app-1', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  describe('createVersion', () => {
    it('rejects a duplicate version string for the same app', async () => {
      repository.findByIdInOrganization.mockResolvedValue(app);
      repository.listVersions.mockResolvedValue([{ version: '1.0.0' } as never]);

      await expect(
        service.createVersion('app-1', 'org-1', {
          version: '1.0.0',
          manifest: {},
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createVersion).not.toHaveBeenCalled();
    });

    it('rejects submitting a new version for a suspended app', async () => {
      repository.findByIdInOrganization.mockResolvedValue({
        ...app,
        status: MarketplaceAppStatus.SUSPENDED,
      });

      await expect(
        service.createVersion('app-1', 'org-1', { version: '1.0.0', manifest: {} }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('moves a DRAFT app to PENDING_REVIEW on first version submission', async () => {
      repository.findByIdInOrganization.mockResolvedValue(app);
      repository.listVersions.mockResolvedValue([]);
      repository.createVersion.mockResolvedValue({
        id: 'version-1',
        appId: 'app-1',
        version: '1.0.0',
        priceCents: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await service.createVersion('app-1', 'org-1', { version: '1.0.0', manifest: {} });

      expect(repository.setStatus).toHaveBeenCalledWith(
        'app-1',
        MarketplaceAppStatus.PENDING_REVIEW,
      );
    });

    it('leaves an already-published app alone while a new version awaits review', async () => {
      repository.findByIdInOrganization.mockResolvedValue({
        ...app,
        status: MarketplaceAppStatus.PUBLISHED,
      });
      repository.listVersions.mockResolvedValue([{ version: '1.0.0' } as never]);
      repository.createVersion.mockResolvedValue({
        id: 'version-2',
        appId: 'app-1',
        version: '2.0.0',
        priceCents: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as never);

      await service.createVersion('app-1', 'org-1', { version: '2.0.0', manifest: {} });

      expect(repository.setStatus).not.toHaveBeenCalled();
    });
  });
});
