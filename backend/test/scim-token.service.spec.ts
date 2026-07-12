import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ScimTokenRepository } from '../src/modules/scim/scim-token.repository';
import { ScimTokenService } from '../src/modules/scim/scim-token.service';

describe('ScimTokenService', () => {
  let service: ScimTokenService;
  let repository: jest.Mocked<ScimTokenRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScimTokenService,
        {
          provide: ScimTokenRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findByIdInOrg: jest.fn(),
            revoke: jest.fn(),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get(ScimTokenService);
    repository = module.get(ScimTokenRepository);
    tenantContextService = module.get(TenantContextService);
  });

  it('never touches the repository when the caller is not a member of the requested organization', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(service.create('org-not-mine', { name: 'Attempted token' })).rejects.toThrow(
      ForbiddenException,
    );
    expect(repository.create).not.toHaveBeenCalled();

    await expect(service.list('org-not-mine')).rejects.toThrow(ForbiddenException);
    expect(repository.listByOrganization).not.toHaveBeenCalled();

    await expect(service.revoke('org-not-mine', 'token-1')).rejects.toThrow(ForbiddenException);
    expect(repository.findByIdInOrg).not.toHaveBeenCalled();
  });

  it('creates a SCIM token scoped to the requested organization', async () => {
    repository.create.mockResolvedValue({
      id: 'token-1',
      organizationId: 'org-1',
      identityProviderId: null,
      name: 'Test token',
      tokenHash: 'hash',
      status: 'ACTIVE',
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const { entity } = await service.create('org-1', { name: 'Test token' });

    expect(tenantContextService.assertOrganizationAccess).toHaveBeenCalledWith('org-1');
    expect(entity.organizationId).toBe('org-1');
  });
});
