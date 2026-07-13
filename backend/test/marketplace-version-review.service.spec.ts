import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MarketplaceAppStatus, MarketplaceAppVersionStatus } from '@prisma/client';
import { MarketplaceVersionReviewService } from '../src/modules/marketplace/marketplace-version-review.service';
import { MarketplaceAppRepository } from '../src/modules/marketplace/marketplace-app.repository';
import { ExtensionMaterializationService } from '../src/modules/extensions/extension-materialization.service';
import { AuditService } from '../src/modules/audit/audit.service';

describe('MarketplaceVersionReviewService', () => {
  let repository: jest.Mocked<MarketplaceAppRepository>;
  let auditService: jest.Mocked<AuditService>;
  let extensionMaterializationService: jest.Mocked<ExtensionMaterializationService>;
  let service: MarketplaceVersionReviewService;

  const pendingVersion = {
    id: 'version-1',
    appId: 'app-1',
    status: MarketplaceAppVersionStatus.PENDING_REVIEW,
    manifest: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    repository = {
      listPendingReviewVersions: jest.fn(),
      approveVersion: jest.fn(),
      rejectVersion: jest.fn(),
      hasEverPublishedVersion: jest.fn(),
      findVersionById: jest.fn(),
      findByIdUnscoped: jest.fn(),
      setStatus: jest.fn(),
    } as never;
    auditService = { record: jest.fn(), recordWithExplicitActor: jest.fn() } as never;
    extensionMaterializationService = { materializeFromVersion: jest.fn() } as never;

    service = new MarketplaceVersionReviewService(
      repository,
      auditService,
      extensionMaterializationService,
    );
  });

  it('404s approving a version that does not exist', async () => {
    repository.findVersionById.mockResolvedValue(null);

    await expect(service.approve('version-1', 'admin-1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects approving a version that is not pending review', async () => {
    repository.findVersionById.mockResolvedValue({
      ...pendingVersion,
      status: MarketplaceAppVersionStatus.PUBLISHED,
    } as never);

    await expect(service.approve('version-1', 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('approving a version publishes both the version and the app', async () => {
    repository.findVersionById.mockResolvedValue(pendingVersion as never);
    repository.approveVersion.mockResolvedValue({
      ...pendingVersion,
      status: MarketplaceAppVersionStatus.PUBLISHED,
    } as never);
    repository.findByIdUnscoped.mockResolvedValue({
      developerOrganizationId: 'dev-org-1',
    } as never);

    await service.approve('version-1', 'admin-1');

    expect(repository.approveVersion).toHaveBeenCalledWith('version-1', 'admin-1');
    expect(repository.setStatus).toHaveBeenCalledWith('app-1', MarketplaceAppStatus.PUBLISHED);
    expect(extensionMaterializationService.materializeFromVersion).toHaveBeenCalledWith(
      'app-1',
      'version-1',
      {},
    );
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'marketplace_app_version.approved', userId: 'admin-1' }),
    );
  });

  describe('reject', () => {
    it('reverts a never-before-published app back to DRAFT', async () => {
      repository.findVersionById.mockResolvedValue(pendingVersion as never);
      repository.rejectVersion.mockResolvedValue({
        ...pendingVersion,
        status: MarketplaceAppVersionStatus.REJECTED,
      } as never);
      repository.hasEverPublishedVersion.mockResolvedValue(false);
      repository.findByIdUnscoped.mockResolvedValue({
        developerOrganizationId: 'dev-org-1',
      } as never);

      await service.reject('version-1', 'admin-1', { reason: 'broken endpoint' });

      expect(repository.setStatus).toHaveBeenCalledWith('app-1', MarketplaceAppStatus.DRAFT);
    });

    it('leaves an already-published app on its prior good version when a new one is rejected', async () => {
      repository.findVersionById.mockResolvedValue(pendingVersion as never);
      repository.rejectVersion.mockResolvedValue({
        ...pendingVersion,
        status: MarketplaceAppVersionStatus.REJECTED,
      } as never);
      repository.hasEverPublishedVersion.mockResolvedValue(true);
      repository.findByIdUnscoped.mockResolvedValue({
        developerOrganizationId: 'dev-org-1',
      } as never);

      await service.reject('version-1', 'admin-1', { reason: 'broken endpoint' });

      expect(repository.setStatus).not.toHaveBeenCalled();
    });
  });
});
