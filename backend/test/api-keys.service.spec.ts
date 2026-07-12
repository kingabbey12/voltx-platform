import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { PermissionRepository } from '../src/modules/permissions/permission.repository';
import { ApiKeyRepository } from '../src/modules/security/api-key.repository';
import { ApiKeysService } from '../src/modules/security/api-keys.service';

describe('ApiKeysService', () => {
  let service: ApiKeysService;
  let apiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let permissionRepository: jest.Mocked<PermissionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeysService,
        {
          provide: ApiKeyRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findByIdInOrganization: jest.fn(),
            revoke: jest.fn(),
          },
        },
        {
          provide: PermissionRepository,
          useValue: { findAll: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, fallback: unknown) => fallback) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(ApiKeysService);
    apiKeyRepository = module.get(ApiKeyRepository);
    permissionRepository = module.get(PermissionRepository);
  });

  it('rejects scoping a key to a permission the caller does not hold', async () => {
    await expect(
      service.create('org-1', 'user-1', ['sales.opportunity.read'], {
        name: 'Bad bot',
        scopedPermissions: ['organization.delete'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(apiKeyRepository.create).not.toHaveBeenCalled();
  });

  it('rejects scoping a key to an unknown permission key', async () => {
    permissionRepository.findAll.mockResolvedValue([
      {
        id: 'p1',
        key: 'sales.opportunity.read',
        resource: 'sales_opportunity',
        action: 'read',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      service.create('org-1', 'user-1', ['sales.opportunity.read', 'made.up.permission'], {
        name: 'Bad bot',
        scopedPermissions: ['sales.opportunity.read', 'made.up.permission'],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(apiKeyRepository.create).not.toHaveBeenCalled();
  });

  it('creates a key and returns the raw secret exactly once', async () => {
    permissionRepository.findAll.mockResolvedValue([
      {
        id: 'p1',
        key: 'sales.opportunity.read',
        resource: 'sales_opportunity',
        action: 'read',
        description: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    apiKeyRepository.create.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      name: 'CI bot',
      keyHash: 'hash',
      keyPrefix: 'vk_ab12...',
      scopedPermissions: ['sales.opportunity.read'],
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    const result = await service.create('org-1', 'user-1', ['sales.opportunity.read'], {
      name: 'CI bot',
      scopedPermissions: ['sales.opportunity.read'],
    });

    expect(result.apiKey).toMatch(/^vk_/);
    expect(result.id).toBe('key-1');
    expect(apiKeyRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        createdByUserId: 'user-1',
        name: 'CI bot',
        scopedPermissions: ['sales.opportunity.read'],
      }),
    );
  });

  it('throws NotFoundException revoking a key from a different organization', async () => {
    apiKeyRepository.findByIdInOrganization.mockResolvedValue(null);
    await expect(service.revoke('key-1', 'org-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});
