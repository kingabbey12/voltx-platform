import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccountStatus } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import {
  ServiceAccountEntity,
  ServiceAccountTokenEntity,
} from '../src/modules/developer-platform/entities/service-account.entity';
import { ServiceAccountRepository } from '../src/modules/developer-platform/service-account.repository';
import { ServiceAccountService } from '../src/modules/developer-platform/service-account.service';
import { PermissionService } from '../src/modules/permissions/permission.service';
import { RoleRepository } from '../src/modules/roles/role.repository';

function makeServiceAccount(overrides: Partial<ServiceAccountEntity> = {}): ServiceAccountEntity {
  return {
    id: 'sa-1',
    organizationId: 'org-1',
    userId: 'user-synthetic-1',
    name: 'CI Pipeline',
    description: null,
    status: ServiceAccountStatus.ACTIVE,
    createdByUserId: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeToken(overrides: Partial<ServiceAccountTokenEntity> = {}): ServiceAccountTokenEntity {
  return {
    id: 'token-1',
    serviceAccountId: 'sa-1',
    name: 'Production token',
    tokenHash: 'hash',
    tokenPrefix: 'vsa_ab12cd34...',
    expiresAt: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('ServiceAccountService', () => {
  let service: ServiceAccountService;
  let repository: jest.Mocked<ServiceAccountRepository>;
  let roleRepository: jest.Mocked<RoleRepository>;
  let permissionService: jest.Mocked<PermissionService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceAccountService,
        {
          provide: ServiceAccountRepository,
          useValue: {
            create: jest.fn(),
            listByOrganization: jest.fn(),
            findByIdInOrganization: jest.fn(),
            findByIdUnscoped: jest.fn(),
            setStatus: jest.fn(),
            createToken: jest.fn(),
            listTokens: jest.fn(),
            findTokenByIdForAccount: jest.fn(),
            revokeToken: jest.fn(),
          },
        },
        { provide: RoleRepository, useValue: { findById: jest.fn() } },
        { provide: PermissionService, useValue: { getPermissionKeysForRole: jest.fn() } },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_k: string, fallback: unknown) => fallback) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
        { provide: TenantContextService, useValue: { assertOrganizationAccess: jest.fn() } },
      ],
    }).compile();

    service = module.get(ServiceAccountService);
    repository = module.get(ServiceAccountRepository);
    roleRepository = module.get(RoleRepository);
    permissionService = module.get(PermissionService);
    tenantContextService = module.get(TenantContextService);
  });

  describe('cross-tenant isolation', () => {
    it('never touches the repository when the caller is not a member of the requested organization', async () => {
      tenantContextService.assertOrganizationAccess.mockImplementation(() => {
        throw new ForbiddenException('Cross-tenant access is forbidden');
      });

      await expect(
        service.create('org-not-mine', 'admin-1', [], { name: 'x', roleId: 'role-1' }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();

      await expect(service.list('org-not-mine')).rejects.toThrow(ForbiddenException);
      expect(repository.listByOrganization).not.toHaveBeenCalled();

      await expect(service.getOrThrow('sa-1', 'org-not-mine')).rejects.toThrow(ForbiddenException);
      expect(repository.findByIdInOrganization).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    it('rejects an unknown roleId', async () => {
      roleRepository.findById.mockResolvedValue(null);
      await expect(
        service.create('org-1', 'admin-1', ['organization.read'], {
          name: 'x',
          roleId: 'bad-role',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("rejects granting a role with permissions the caller doesn't hold", async () => {
      roleRepository.findById.mockResolvedValue({ id: 'role-admin' } as never);
      permissionService.getPermissionKeysForRole.mockResolvedValue([
        'organization.read',
        'organization.delete',
      ]);

      await expect(
        service.create('org-1', 'caller-1', ['organization.read'], {
          name: 'Escalation attempt',
          roleId: 'role-admin',
        }),
      ).rejects.toThrow(ForbiddenException);
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('creates a service account when the role is within the caller’s own permissions', async () => {
      roleRepository.findById.mockResolvedValue({ id: 'role-member' } as never);
      permissionService.getPermissionKeysForRole.mockResolvedValue(['organization.read']);
      repository.create.mockResolvedValue(makeServiceAccount());

      const result = await service.create(
        'org-1',
        'caller-1',
        ['organization.read', 'user.create'],
        {
          name: 'CI Pipeline',
          roleId: 'role-member',
        },
      );

      expect(result.id).toBe('sa-1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: 'org-1', roleId: 'role-member' }),
      );
    });
  });

  describe('lifecycle', () => {
    it('throws NotFoundException for a service account outside the organization', async () => {
      repository.findByIdInOrganization.mockResolvedValue(null);
      await expect(service.getOrThrow('sa-1', 'org-1')).rejects.toThrow(NotFoundException);
    });

    it('suspends and reactivates a service account', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeServiceAccount());
      repository.setStatus.mockResolvedValue(
        makeServiceAccount({ status: ServiceAccountStatus.SUSPENDED }),
      );

      const result = await service.setStatus('sa-1', 'org-1', ServiceAccountStatus.SUSPENDED);

      expect(result.status).toBe(ServiceAccountStatus.SUSPENDED);
      expect(repository.setStatus).toHaveBeenCalledWith('sa-1', ServiceAccountStatus.SUSPENDED);
    });
  });

  describe('tokens', () => {
    it('rejects issuing a token for a suspended service account', async () => {
      repository.findByIdInOrganization.mockResolvedValue(
        makeServiceAccount({ status: ServiceAccountStatus.SUSPENDED }),
      );
      await expect(service.createToken('sa-1', 'org-1', { name: 'New token' })).rejects.toThrow(
        ForbiddenException,
      );
      expect(repository.createToken).not.toHaveBeenCalled();
    });

    it('issues a token and returns the raw secret exactly once', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeServiceAccount());
      repository.createToken.mockResolvedValue(makeToken());

      const result = await service.createToken('sa-1', 'org-1', { name: 'Production token' });

      expect(result.token).toMatch(/^vsa_/);
    });

    it('rejects revoking a token that already belongs to a different service account', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeServiceAccount());
      repository.findTokenByIdForAccount.mockResolvedValue(null);

      await expect(service.revokeToken('sa-1', 'not-its-token', 'org-1')).rejects.toThrow(
        NotFoundException,
      );
      expect(repository.revokeToken).not.toHaveBeenCalled();
    });

    it('revokes an active token', async () => {
      repository.findByIdInOrganization.mockResolvedValue(makeServiceAccount());
      repository.findTokenByIdForAccount.mockResolvedValue(makeToken());

      await service.revokeToken('sa-1', 'token-1', 'org-1');

      expect(repository.revokeToken).toHaveBeenCalledWith('token-1');
    });
  });
});
