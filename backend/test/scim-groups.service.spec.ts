import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { RoleRepository } from '../src/modules/roles/role.repository';
import { ScimGroupsService } from '../src/modules/scim/scim-groups.service';
import { ScimProvisionJobRepository } from '../src/modules/scim/scim-provision-job.repository';

function makeRole(overrides: Partial<{ id: string; key: string; name: string }> = {}) {
  return {
    id: 'role-admin',
    key: 'admin',
    name: 'Admin',
    description: null,
    isSystem: true,
    permissionKeys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('ScimGroupsService', () => {
  let service: ScimGroupsService;
  let prisma: {
    system: {
      membership: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    };
  };
  let roleRepository: jest.Mocked<RoleRepository>;
  let scimProvisionJobRepository: jest.Mocked<ScimProvisionJobRepository>;

  beforeEach(async () => {
    prisma = {
      system: {
        membership: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScimGroupsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: RoleRepository,
          useValue: { findById: jest.fn(), findByKeyOrThrow: jest.fn(), findAll: jest.fn() },
        },
        { provide: ScimProvisionJobRepository, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(ScimGroupsService);
    roleRepository = module.get(RoleRepository);
    scimProvisionJobRepository = module.get(ScimProvisionJobRepository);
  });

  it('adding a member to a group assigns that role, scoped to an active membership in the org', async () => {
    roleRepository.findById.mockResolvedValue(makeRole());
    roleRepository.findByKeyOrThrow.mockResolvedValue(
      makeRole({ id: 'role-member', key: 'member' }),
    );
    prisma.system.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
    prisma.system.membership.findMany.mockResolvedValue([]);

    await service.patch('org-1', 'scim-token-1', 'role-admin', {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'add', path: 'members', value: [{ value: 'user-1' }] }],
    });

    expect(prisma.system.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1', status: MembershipStatus.ACTIVE },
    });
    expect(prisma.system.membership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { roleId: 'role-admin' },
    });
  });

  it('rejects assigning a role to a user who is not an active member of the organization', async () => {
    roleRepository.findById.mockResolvedValue(makeRole());
    roleRepository.findByKeyOrThrow.mockResolvedValue(
      makeRole({ id: 'role-member', key: 'member' }),
    );
    prisma.system.membership.findFirst.mockResolvedValue(null);

    await expect(
      service.patch('org-1', 'scim-token-1', 'role-admin', {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'add', path: 'members', value: [{ value: 'not-a-member' }] }],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('removing a member from a group falls back to the "member" role', async () => {
    roleRepository.findById.mockResolvedValue(makeRole());
    const fallbackRole = makeRole({ id: 'role-member', key: 'member' });
    roleRepository.findByKeyOrThrow.mockResolvedValue(fallbackRole);
    prisma.system.membership.findFirst.mockResolvedValue({ id: 'membership-1' });
    prisma.system.membership.findMany.mockResolvedValue([]);

    await service.patch('org-1', 'scim-token-1', 'role-admin', {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'remove', path: 'members', value: [{ value: 'user-1' }] }],
    });

    expect(prisma.system.membership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { roleId: 'role-member' },
    });
  });

  it('records a GROUP_SYNC provisioning job after a successful patch', async () => {
    roleRepository.findById.mockResolvedValue(makeRole());
    roleRepository.findByKeyOrThrow.mockResolvedValue(
      makeRole({ id: 'role-member', key: 'member' }),
    );
    prisma.system.membership.findMany.mockResolvedValue([]);

    await service.patch('org-1', 'scim-token-1', 'role-admin', {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [],
    });

    expect(scimProvisionJobRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        scimTokenId: 'scim-token-1',
        operation: 'GROUP_SYNC',
      }),
    );
  });
});
