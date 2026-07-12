import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus, ScimProvisionJobStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { RefreshTokenRepository } from '../src/modules/auth/refresh-token.repository';
import { RoleRepository } from '../src/modules/roles/role.repository';
import { ScimProvisionJobRepository } from '../src/modules/scim/scim-provision-job.repository';
import { ScimUsersService } from '../src/modules/scim/scim-users.service';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UsersRepository } from '../src/modules/users/users.repository';

function makeRole(overrides: Partial<{ id: string; key: string }> = {}) {
  return {
    id: 'role-member',
    key: 'member',
    name: 'Member',
    description: null,
    isSystem: true,
    permissionKeys: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeUser(overrides: Partial<UserEntity> = {}): UserEntity {
  return {
    id: 'user-1',
    email: 'jane@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    avatarUrl: null,
    phoneNumber: null,
    jobTitle: null,
    status: 'ACTIVE',
    isPlatformAdmin: false,
    mfaEnabled: false,
    lastLoginAt: null,
    emailVerifiedAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('ScimUsersService', () => {
  let service: ScimUsersService;
  let prisma: {
    system: {
      membership: {
        findFirst: jest.Mock;
        findMany: jest.Mock;
        count: jest.Mock;
        create: jest.Mock;
        update: jest.Mock;
      };
      $transaction: jest.Mock;
    };
  };
  let usersRepository: jest.Mocked<UsersRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let scimProvisionJobRepository: jest.Mocked<ScimProvisionJobRepository>;

  beforeEach(async () => {
    prisma = {
      system: {
        membership: {
          findFirst: jest.fn(),
          findMany: jest.fn(),
          count: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        $transaction: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScimUsersService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: UsersRepository,
          useValue: { findByEmail: jest.fn(), findById: jest.fn(), update: jest.fn() },
        },
        { provide: RoleRepository, useValue: { findByKeyOrThrow: jest.fn() } },
        { provide: RefreshTokenRepository, useValue: { revokeAllByUserId: jest.fn() } },
        { provide: ScimProvisionJobRepository, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(ScimUsersService);
    usersRepository = module.get(UsersRepository);
    roleRepository = module.get(RoleRepository);
    refreshTokenRepository = module.get(RefreshTokenRepository);
    scimProvisionJobRepository = module.get(ScimProvisionJobRepository);

    roleRepository.findByKeyOrThrow.mockResolvedValue(makeRole());
  });

  it('rejects create() when userName is missing', async () => {
    await expect(service.create('org-1', 'scim-token-1', {})).rejects.toThrow(BadRequestException);
  });

  it('creates a brand-new user and membership transactionally for a new email', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);
    const createdUser = makeUser({ id: 'new-user-1', email: 'new@example.com' });
    prisma.system.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          user: { create: jest.fn().mockResolvedValue(createdUser) },
          membership: { create: jest.fn().mockResolvedValue({ id: 'membership-1' }) },
        }),
      ),
    );

    const resource = await service.create('org-1', 'scim-token-1', {
      userName: 'new@example.com',
      name: { givenName: 'New', familyName: 'Person' },
    });

    expect(resource.userName).toBe('new@example.com');
    expect(resource.active).toBe(true);
    expect(scimProvisionJobRepository.record).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', scimTokenId: 'scim-token-1' }),
    );
  });

  it('rejects create() with a conflict when the user already has an active membership in this org', async () => {
    usersRepository.findByEmail.mockResolvedValue(makeUser());
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.ACTIVE,
    });

    await expect(
      service.create('org-1', 'scim-token-1', { userName: 'jane@example.com' }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.system.membership.create).not.toHaveBeenCalled();
  });

  it('reactivates an inactive membership for an existing user rather than duplicating it', async () => {
    usersRepository.findByEmail.mockResolvedValue(makeUser());
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.INACTIVE,
    });

    const resource = await service.create('org-1', 'scim-token-1', {
      userName: 'jane@example.com',
    });

    expect(prisma.system.membership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { status: MembershipStatus.ACTIVE },
    });
    expect(resource.active).toBe(true);
  });

  it('throws NotFoundException for a SCIM user id with no membership in this organization', async () => {
    prisma.system.membership.findFirst.mockResolvedValue(null);
    await expect(service.getById('org-1', 'user-does-not-exist')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('scopes every membership lookup by the given organizationId (cross-tenant safety)', async () => {
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      status: MembershipStatus.ACTIVE,
      user: makeUser(),
    });

    await service.getById('org-A', 'user-1');

    expect(prisma.system.membership.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org-A', userId: 'user-1' } }),
    );
  });

  it('deactivating a user via PATCH active:false revokes all of their refresh tokens', async () => {
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      status: MembershipStatus.ACTIVE,
      user: makeUser(),
    });
    usersRepository.findById.mockResolvedValue(makeUser());

    await service.patch('org-1', 'scim-token-1', 'user-1', {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
      Operations: [{ op: 'replace', path: 'active', value: false }],
    });

    expect(prisma.system.membership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { status: MembershipStatus.INACTIVE },
    });
    expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1');
  });

  it('DELETE deactivates the membership without touching the shared User row', async () => {
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      userId: 'user-1',
      status: MembershipStatus.ACTIVE,
      user: makeUser(),
    });

    await service.remove('org-1', 'scim-token-1', 'user-1');

    expect(prisma.system.membership.update).toHaveBeenCalledWith({
      where: { id: 'membership-1' },
      data: { status: MembershipStatus.INACTIVE },
    });
    expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1');
    const jobCall = scimProvisionJobRepository.record.mock.calls[0][0] as {
      status: ScimProvisionJobStatus;
    };
    expect(jobCall.status).toBe(ScimProvisionJobStatus.SUCCESS);
  });

  it('rejects an unsupported SCIM filter expression instead of ignoring it', async () => {
    await expect(
      service.list('org-1', 'scim-token-1', {
        filter: 'userName co "example"',
        startIndex: 1,
        count: 10,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a userName eq filter and scopes the membership query by email', async () => {
    prisma.system.membership.findMany.mockResolvedValue([]);
    prisma.system.membership.count.mockResolvedValue(0);

    await service.list('org-1', 'scim-token-1', {
      filter: 'userName eq "jane@example.com"',
      startIndex: 1,
      count: 10,
    });

    expect(prisma.system.membership.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', user: { email: 'jane@example.com' } },
      }),
    );
  });
});
