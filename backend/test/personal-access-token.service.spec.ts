import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PermissionRepository } from '../src/modules/permissions/permission.repository';
import { PersonalAccessTokenEntity } from '../src/modules/developer-platform/entities/personal-access-token.entity';
import { PersonalAccessTokenRepository } from '../src/modules/developer-platform/personal-access-token.repository';
import { PersonalAccessTokenService } from '../src/modules/developer-platform/personal-access-token.service';

function makeToken(overrides: Partial<PersonalAccessTokenEntity> = {}): PersonalAccessTokenEntity {
  return {
    id: 'pat-1',
    userId: 'user-1',
    name: 'Local dev script',
    tokenHash: 'hash',
    tokenPrefix: 'vpat_ab12cd34...',
    scopedPermissions: ['sales.opportunity.read'],
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('PersonalAccessTokenService', () => {
  let service: PersonalAccessTokenService;
  let repository: jest.Mocked<PersonalAccessTokenRepository>;
  let permissionRepository: jest.Mocked<PermissionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalAccessTokenService,
        {
          provide: PersonalAccessTokenRepository,
          useValue: {
            create: jest.fn(),
            listByUser: jest.fn(),
            findByIdForUser: jest.fn(),
            revoke: jest.fn(),
          },
        },
        {
          provide: PermissionRepository,
          useValue: {
            findAll: jest
              .fn()
              .mockResolvedValue([
                { key: 'sales.opportunity.read' },
                { key: 'sales.opportunity.update' },
              ]),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, fallback: unknown) => fallback) },
        },
      ],
    }).compile();

    service = module.get(PersonalAccessTokenService);
    repository = module.get(PersonalAccessTokenRepository);
    permissionRepository = module.get(PermissionRepository);
  });

  it('creates a token and returns the raw secret exactly once', async () => {
    repository.create.mockResolvedValue(makeToken());

    const result = await service.create('user-1', {
      name: 'Local dev script',
      scopedPermissions: ['sales.opportunity.read'],
    });

    expect(result.token).toMatch(/^vpat_/);
    expect(result.id).toBe('pat-1');
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', scopedPermissions: ['sales.opportunity.read'] }),
    );
  });

  it('rejects an unknown permission key', async () => {
    await expect(
      service.create('user-1', { name: 'Bad', scopedPermissions: ['not.a.real.permission'] }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('does not require the caller to already hold the requested permission at creation time', async () => {
    // Deliberately different from ApiKeysService: enforcement happens per
    // request in the guard, not at creation, since a PAT has no single org.
    repository.create.mockResolvedValue(
      makeToken({ scopedPermissions: ['sales.opportunity.update'] }),
    );

    await expect(
      service.create('user-1', { name: 'Fine', scopedPermissions: ['sales.opportunity.update'] }),
    ).resolves.toBeDefined();
    expect(permissionRepository.findAll).toHaveBeenCalled();
  });

  it('lists only the caller’s own tokens', async () => {
    repository.listByUser.mockResolvedValue([makeToken()]);
    const result = await service.list('user-1');
    expect(result).toHaveLength(1);
    expect(repository.listByUser).toHaveBeenCalledWith('user-1');
  });

  it('throws NotFoundException revoking a token that does not belong to the caller', async () => {
    repository.findByIdForUser.mockResolvedValue(null);
    await expect(service.revoke('not-mine', 'user-1')).rejects.toThrow(NotFoundException);
    expect(repository.revoke).not.toHaveBeenCalled();
  });

  it('rejects revoking an already-revoked token', async () => {
    repository.findByIdForUser.mockResolvedValue(makeToken({ revokedAt: new Date() }));
    await expect(service.revoke('pat-1', 'user-1')).rejects.toThrow(ForbiddenException);
  });

  it('revokes an active token', async () => {
    repository.findByIdForUser.mockResolvedValue(makeToken());
    await service.revoke('pat-1', 'user-1');
    expect(repository.revoke).toHaveBeenCalledWith('pat-1');
  });
});
