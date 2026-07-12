import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { OrganizationStructureRepository } from '../src/modules/organization-structure/organization-structure.repository';
import { OrganizationStructureService } from '../src/modules/organization-structure/organization-structure.service';

function makeBusinessUnit(
  overrides: Partial<{ id: string; parentBusinessUnitId: string | null }> = {},
) {
  return {
    id: 'bu-1',
    organizationId: 'org-1',
    name: 'Engineering',
    parentBusinessUnitId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('OrganizationStructureService', () => {
  let service: OrganizationStructureService;
  let repository: jest.Mocked<OrganizationStructureRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationStructureService,
        {
          provide: OrganizationStructureRepository,
          useValue: {
            createBusinessUnit: jest.fn(),
            findBusinessUnitInOrg: jest.fn(),
            updateBusinessUnit: jest.fn(),
            deleteBusinessUnit: jest.fn(),
            listBusinessUnits: jest.fn(),
            getBusinessUnitParentChainIds: jest.fn(),
            createDepartment: jest.fn(),
            findDepartmentInOrg: jest.fn(),
            listDepartments: jest.fn(),
            updateDepartment: jest.fn(),
            getDepartmentParentChainIds: jest.fn(),
            createTeam: jest.fn(),
            findTeamInOrg: jest.fn(),
            tagMembership: jest.fn(),
          },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get(OrganizationStructureService);
    repository = module.get(OrganizationStructureRepository);
    tenantContextService = module.get(TenantContextService);
  });

  it('never touches the repository when the caller is not a member of the requested organization', async () => {
    tenantContextService.assertOrganizationAccess.mockImplementation(() => {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    });

    await expect(
      service.createBusinessUnit('org-not-mine', { name: 'Attempted cross-tenant unit' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.createBusinessUnit).not.toHaveBeenCalled();

    await expect(service.listDepartments('org-not-mine')).rejects.toThrow(ForbiddenException);
    expect(repository.listDepartments).not.toHaveBeenCalled();
  });

  it('rejects setting a business unit as its own parent', async () => {
    repository.findBusinessUnitInOrg.mockResolvedValue(makeBusinessUnit({ id: 'bu-1' }));

    await expect(
      service.updateBusinessUnit('org-1', 'bu-1', { parentBusinessUnitId: 'bu-1' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.updateBusinessUnit).not.toHaveBeenCalled();
  });

  it('rejects a business unit parent reassignment that would create a cycle', async () => {
    // bu-1 is currently the parent of bu-2; attempting to make bu-2 the
    // parent of bu-1 would create a 2-node cycle.
    repository.findBusinessUnitInOrg.mockImplementation((_org, id) =>
      Promise.resolve(makeBusinessUnit({ id })),
    );
    repository.getBusinessUnitParentChainIds.mockResolvedValue(['bu-2', 'bu-1']);

    await expect(
      service.updateBusinessUnit('org-1', 'bu-1', { parentBusinessUnitId: 'bu-2' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.updateBusinessUnit).not.toHaveBeenCalled();
  });

  it('allows a valid, non-cyclic business unit parent reassignment', async () => {
    repository.findBusinessUnitInOrg.mockImplementation((_org, id) =>
      Promise.resolve(makeBusinessUnit({ id })),
    );
    repository.getBusinessUnitParentChainIds.mockResolvedValue(['bu-3']);
    repository.updateBusinessUnit.mockResolvedValue(
      makeBusinessUnit({ id: 'bu-1', parentBusinessUnitId: 'bu-2' }),
    );

    await service.updateBusinessUnit('org-1', 'bu-1', { parentBusinessUnitId: 'bu-2' });

    expect(repository.updateBusinessUnit).toHaveBeenCalledWith('bu-1', {
      name: undefined,
      parentBusinessUnitId: 'bu-2',
    });
  });

  it('throws NotFoundException when the parent business unit does not exist in this organization', async () => {
    repository.findBusinessUnitInOrg.mockImplementation((_org, id) =>
      Promise.resolve(id === 'bu-1' ? makeBusinessUnit({ id: 'bu-1' }) : null),
    );

    await expect(
      service.updateBusinessUnit('org-1', 'bu-1', { parentBusinessUnitId: 'does-not-exist' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('validates that a tagged business unit/department/team exist before tagging a membership', async () => {
    repository.findBusinessUnitInOrg.mockResolvedValue(null);

    await expect(
      service.tagMembership('org-1', 'membership-1', { businessUnitId: 'does-not-exist' }),
    ).rejects.toThrow(NotFoundException);
    expect(repository.tagMembership).not.toHaveBeenCalled();
  });
});
