import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UsersRepository } from '../src/modules/users/users.repository';
import { PlatformUserService } from '../src/modules/platform/users/platform-user.service';

function makeUserEntity(overrides: Partial<UserEntity> = {}): UserEntity {
  const entity = new UserEntity();
  Object.assign(entity, {
    id: 'user-1',
    email: 'user@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    avatarUrl: null,
    phoneNumber: null,
    jobTitle: null,
    status: UserStatus.ACTIVE,
    isPlatformAdmin: false,
    mfaEnabled: false,
    lastLoginAt: null,
    emailVerifiedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
  return entity;
}

describe('PlatformUserService', () => {
  let service: PlatformUserService;
  let usersRepository: jest.Mocked<UsersRepository>;
  let prisma: { system: { membership: { findMany: jest.Mock } } };

  beforeEach(async () => {
    prisma = { system: { membership: { findMany: jest.fn() } } };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformUserService,
        {
          provide: UsersRepository,
          useValue: { searchUnscoped: jest.fn(), findByIdUnscoped: jest.fn() },
        },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PlatformUserService);
    usersRepository = module.get(UsersRepository);
  });

  it('searches across every user on the platform', async () => {
    usersRepository.searchUnscoped.mockResolvedValue({
      items: [makeUserEntity()],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await service.search({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].email).toBe('user@example.com');
  });

  it('throws NotFoundException for an unknown user id', async () => {
    usersRepository.findByIdUnscoped.mockResolvedValue(null);
    await expect(service.getDetail('not-real')).rejects.toThrow(NotFoundException);
  });

  it("returns a user's detail with every organization membership across tenants", async () => {
    usersRepository.findByIdUnscoped.mockResolvedValue(makeUserEntity());
    prisma.system.membership.findMany.mockResolvedValue([
      {
        organizationId: 'org-1',
        organization: { name: 'Acme', slug: 'acme' },
        role: { name: 'Admin' },
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        organizationId: 'org-2',
        organization: { name: 'Globex', slug: 'globex' },
        role: { name: 'Member' },
        status: MembershipStatus.ACTIVE,
        joinedAt: new Date('2026-02-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.getDetail('user-1');

    expect(result.memberships).toHaveLength(2);
    expect(result.memberships[0]).toMatchObject({
      organizationId: 'org-1',
      organizationName: 'Acme',
      roleName: 'Admin',
    });
    expect(result.memberships[1]).toMatchObject({
      organizationId: 'org-2',
      organizationName: 'Globex',
      roleName: 'Member',
    });
  });
});
