import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { PermissionRepository } from '../src/modules/permissions/permission.repository';
import { RoleRepository } from '../src/modules/roles/role.repository';
import { RoleService } from '../src/modules/roles/role.service';

describe('RoleService', () => {
  let service: RoleService;
  let repository: jest.Mocked<RoleRepository>;
  let auditService: jest.Mocked<AuditService>;

  const systemRoleEntity = {
    id: 'system-role-id',
    key: 'admin',
    name: 'Admin',
    description: 'Administrative access',
    isSystem: true,
    organizationId: null,
    permissionKeys: ['user.read', 'organization.read'],
    createdAt: new Date('2026-07-03T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
  };

  const customRoleEntity = {
    id: 'custom-role-id',
    key: 'sales-manager',
    name: 'Sales Manager',
    description: null,
    isSystem: false,
    organizationId: 'org-id',
    permissionKeys: ['sales.opportunity.read'],
    createdAt: new Date('2026-07-03T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
  };

  const permissionCatalog = [
    {
      id: 'perm-1',
      key: 'sales.opportunity.read',
      resource: 'sales_opportunity',
      action: 'read',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'perm-2',
      key: 'sales.opportunity.update',
      resource: 'sales_opportunity',
      action: 'update',
      description: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: RoleRepository,
          useValue: {
            findAllForOrganization: jest.fn(),
            findByIdForOrganization: jest.fn(),
            findByKey: jest.fn(),
            isKeyTaken: jest.fn().mockResolvedValue(false),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            countActiveMembershipsForRole: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: PermissionRepository,
          useValue: {
            findAll: jest.fn().mockResolvedValue(permissionCatalog),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
            recordWithExplicitActor: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RoleService);
    repository = module.get(RoleRepository);
    auditService = module.get(AuditService);
  });

  it("returns system roles plus this organization's custom roles", async () => {
    repository.findAllForOrganization.mockResolvedValue([systemRoleEntity, customRoleEntity]);

    const result = await service.findAll('org-id');

    expect(repository.findAllForOrganization).toHaveBeenCalledWith('org-id');
    expect(result.items).toHaveLength(2);
  });

  it('returns role by id scoped to the organization', async () => {
    repository.findByIdForOrganization.mockResolvedValue(customRoleEntity);

    const result = await service.findOne('custom-role-id', 'org-id');

    expect(repository.findByIdForOrganization).toHaveBeenCalledWith('custom-role-id', 'org-id');
    expect(result.key).toBe('sales-manager');
  });

  it('throws NotFoundException when role does not exist or belongs to another organization', async () => {
    repository.findByIdForOrganization.mockResolvedValue(null);

    await expect(service.findOne('missing-id', 'org-id')).rejects.toThrow(NotFoundException);
  });

  it('creates a custom role with resolved permission ids and a generated key', async () => {
    repository.create.mockResolvedValue(customRoleEntity);

    const result = await service.create('org-id', {
      name: 'Sales Manager',
      permissionKeys: ['sales.opportunity.read'],
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Sales Manager',
        organizationId: 'org-id',
        permissionIds: ['perm-1'],
      }),
    );
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role.created', resourceId: 'custom-role-id' }),
    );
    expect(result.key).toBe('sales-manager');
  });

  it('rejects creating a role with an unknown permission key', async () => {
    await expect(
      service.create('org-id', {
        name: 'Bogus Role',
        permissionKeys: ['not.a.real.permission'],
      }),
    ).rejects.toThrow(BadRequestException);

    expect(repository.create).not.toHaveBeenCalled();
  });

  it("updates a custom role belonging to the caller's organization", async () => {
    repository.findByIdForOrganization.mockResolvedValue(customRoleEntity);
    repository.update.mockResolvedValue({ ...customRoleEntity, name: 'Renamed' });

    const result = await service.update('custom-role-id', 'org-id', { name: 'Renamed' });

    expect(repository.update).toHaveBeenCalledWith('custom-role-id', {
      name: 'Renamed',
      description: undefined,
      permissionIds: undefined,
    });
    expect(result.name).toBe('Renamed');
  });

  it('refuses to update a system role', async () => {
    repository.findByIdForOrganization.mockResolvedValue(systemRoleEntity);

    await expect(
      service.update('system-role-id', 'org-id', { name: 'Hacked Admin' }),
    ).rejects.toThrow(ForbiddenException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('refuses to update a role belonging to a different organization', async () => {
    repository.findByIdForOrganization.mockResolvedValue(null);

    await expect(
      service.update('custom-role-id', 'other-org-id', { name: 'Stolen' }),
    ).rejects.toThrow(NotFoundException);

    expect(repository.update).not.toHaveBeenCalled();
  });

  it('deletes a custom role with no active members', async () => {
    repository.findByIdForOrganization.mockResolvedValue(customRoleEntity);
    repository.countActiveMembershipsForRole.mockResolvedValue(0);

    await service.delete('custom-role-id', 'org-id');

    expect(repository.delete).toHaveBeenCalledWith('custom-role-id');
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'role.deleted', resourceId: 'custom-role-id' }),
    );
  });

  it('refuses to delete a role that still has active members', async () => {
    repository.findByIdForOrganization.mockResolvedValue(customRoleEntity);
    repository.countActiveMembershipsForRole.mockResolvedValue(3);

    await expect(service.delete('custom-role-id', 'org-id')).rejects.toThrow(ConflictException);

    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('refuses to delete a system role', async () => {
    repository.findByIdForOrganization.mockResolvedValue(systemRoleEntity);

    await expect(service.delete('system-role-id', 'org-id')).rejects.toThrow(ForbiddenException);

    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('returns role by key', async () => {
    repository.findByKey.mockResolvedValue(systemRoleEntity);

    const result = await service.findByKey('admin');

    expect(result.key).toBe('admin');
  });

  it('throws NotFoundException for an unknown key', async () => {
    repository.findByKey.mockResolvedValue(null);
    await expect(service.findByKey('missing')).rejects.toThrow(NotFoundException);
  });
});
