import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus } from '@prisma/client';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { PrismaService } from '../src/database/prisma.service';
import { IdentityProviderEntity } from '../src/modules/identity/entities/identity-provider.entity';
import { JitProvisioningService } from '../src/modules/identity/jit/jit-provisioning.service';
import { RoleRepository } from '../src/modules/roles/role.repository';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UsersRepository } from '../src/modules/users/users.repository';

function makeIdp(overrides: Partial<IdentityProviderEntity> = {}): IdentityProviderEntity {
  return {
    id: 'idp-1',
    organizationId: 'org-1',
    name: 'Test IdP',
    protocol: 'SAML',
    preset: 'GENERIC',
    status: 'ACTIVE',
    isDefault: false,
    jitProvisioningEnabled: true,
    defaultRoleKey: 'member',
    roleMappingRules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    samlConfiguration: null,
    oidcConfiguration: null,
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

describe('JitProvisioningService', () => {
  let service: JitProvisioningService;
  let prisma: {
    system: {
      membership: {
        findFirst: jest.Mock<
          Promise<{ id: string; status: MembershipStatus } | null>,
          [{ where: { organizationId: string; userId: string } }]
        >;
        create: jest.Mock<Promise<unknown>, [{ data: Record<string, unknown> }]>;
        update: jest.Mock<
          Promise<unknown>,
          [{ where: { id: string }; data: Record<string, unknown> }]
        >;
      };
      $transaction: jest.Mock<Promise<unknown>, [(tx: unknown) => unknown]>;
    };
  };
  let usersRepository: jest.Mocked<UsersRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let authService: jest.Mocked<AuthService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    prisma = {
      system: {
        membership: {
          findFirst: jest.fn<
            Promise<{ id: string; status: MembershipStatus } | null>,
            [{ where: { organizationId: string; userId: string } }]
          >(),
          create: jest.fn<Promise<unknown>, [{ data: Record<string, unknown> }]>(),
          update: jest.fn<
            Promise<unknown>,
            [{ where: { id: string }; data: Record<string, unknown> }]
          >(),
        },
        $transaction: jest.fn<Promise<unknown>, [(tx: unknown) => unknown]>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JitProvisioningService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: UsersRepository,
          useValue: { findByEmail: jest.fn(), findById: jest.fn() },
        },
        { provide: RoleRepository, useValue: { findByKeyOrThrow: jest.fn() } },
        { provide: AuthService, useValue: { issueTokens: jest.fn() } },
        { provide: AuditService, useValue: { recordWithExplicitActor: jest.fn() } },
      ],
    }).compile();

    service = module.get(JitProvisioningService);
    usersRepository = module.get(UsersRepository);
    roleRepository = module.get(RoleRepository);
    authService = module.get(AuthService);
    auditService = module.get(AuditService);

    roleRepository.findByKeyOrThrow.mockResolvedValue({
      id: 'role-member',
      key: 'member',
      name: 'Member',
      description: null,
      isSystem: true,
      organizationId: null,
      permissionKeys: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    authService.issueTokens.mockResolvedValue({
      accessToken: 'access',
      refreshToken: 'refresh',
      tokenType: 'Bearer',
      expiresIn: 900,
    });
  });

  it('rejects a profile with no email before touching any membership state', async () => {
    const idp = makeIdp();

    await expect(
      service.provisionAndIssueTokens(idp, {
        email: null,
        firstName: null,
        lastName: null,
        groups: [],
      }),
    ).rejects.toThrow(UnauthorizedException);

    expect(prisma.system.membership.findFirst).not.toHaveBeenCalled();
  });

  it('activates an inactive membership for an existing user scoped to the IdP organization only', async () => {
    const idp = makeIdp({ organizationId: 'org-A' });
    usersRepository.findByEmail.mockResolvedValue(makeUser());
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.INACTIVE,
    });
    usersRepository.findById.mockResolvedValue(makeUser());

    await service.provisionAndIssueTokens(idp, {
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      groups: [],
    });

    expect(prisma.system.membership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: 'org-A', userId: 'user-1' },
    });
    const updateArgs = prisma.system.membership.update.mock.calls[0][0];
    expect(updateArgs.where).toEqual({ id: 'membership-1' });
    expect(updateArgs.data.status).toBe(MembershipStatus.ACTIVE);
    expect(updateArgs.data.provisionedByIdentityProviderId).toBe('idp-1');
    expect(authService.issueTokens).toHaveBeenCalledWith('user-1', 'org-A');
  });

  it('never creates or activates a membership in an organization other than the IdP owning organization', async () => {
    const idpForOrgA = makeIdp({ id: 'idp-a', organizationId: 'org-A' });
    usersRepository.findByEmail.mockResolvedValue(makeUser());
    prisma.system.membership.findFirst.mockResolvedValue(null);
    usersRepository.findById.mockResolvedValue(makeUser());

    await service.provisionAndIssueTokens(idpForOrgA, {
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      groups: [],
    });

    // Every membership call must be scoped to org-A (the IdP's own org) —
    // org-A's identity provider must never be able to reach org-B.
    for (const call of prisma.system.membership.findFirst.mock.calls) {
      expect(call[0].where.organizationId).toBe('org-A');
    }
    const createArgs = prisma.system.membership.create.mock.calls[0][0];
    expect(createArgs.data.organizationId).toBe('org-A');
  });

  it('refuses to create a brand-new membership when JIT provisioning is disabled', async () => {
    const idp = makeIdp({ jitProvisioningEnabled: false });
    usersRepository.findByEmail.mockResolvedValue(makeUser());
    prisma.system.membership.findFirst.mockResolvedValue(null);

    await expect(
      service.provisionAndIssueTokens(idp, {
        email: 'jane@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        groups: [],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.system.membership.create).not.toHaveBeenCalled();
    expect(authService.issueTokens).not.toHaveBeenCalled();
  });

  it('refuses to provision a brand-new user account when JIT provisioning is disabled', async () => {
    const idp = makeIdp({ jitProvisioningEnabled: false });
    usersRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.provisionAndIssueTokens(idp, {
        email: 'new-person@example.com',
        firstName: 'New',
        lastName: 'Person',
        groups: [],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.system.$transaction).not.toHaveBeenCalled();
  });

  it('resolves the mapped role from roleMappingRules by matching group membership', async () => {
    const idp = makeIdp({
      defaultRoleKey: 'member',
      roleMappingRules: [{ sourceValue: 'Engineering', roleKey: 'admin' }],
    });
    usersRepository.findByEmail.mockResolvedValue(makeUser());
    prisma.system.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      status: MembershipStatus.ACTIVE,
    });
    usersRepository.findById.mockResolvedValue(makeUser());

    await service.provisionAndIssueTokens(idp, {
      email: 'jane@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      groups: ['Engineering'],
    });

    expect(roleRepository.findByKeyOrThrow).toHaveBeenCalledWith('admin');
  });

  it('creates a brand-new user and membership transactionally when none exists and JIT is enabled', async () => {
    const idp = makeIdp({ organizationId: 'org-A' });
    usersRepository.findByEmail.mockResolvedValue(null);
    const createdUser = makeUser({ id: 'new-user-1', email: 'new@example.com' });
    prisma.system.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({
          user: { create: jest.fn().mockResolvedValue(createdUser) },
          membership: { create: jest.fn().mockResolvedValue({}) },
        }),
      ),
    );
    usersRepository.findById.mockResolvedValue(createdUser);

    await service.provisionAndIssueTokens(idp, {
      email: 'new@example.com',
      firstName: 'New',
      lastName: 'Person',
      groups: [],
    });

    expect(prisma.system.$transaction).toHaveBeenCalled();
    expect(authService.issueTokens).toHaveBeenCalledWith('new-user-1', 'org-A');
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-A',
        userId: 'new-user-1',
        action: 'sso_login',
      }),
    );
  });
});
