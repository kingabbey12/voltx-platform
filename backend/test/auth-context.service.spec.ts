import { Test, TestingModule } from '@nestjs/testing';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';
import { AuthContextService } from '../src/modules/auth/auth-context.service';
import { PermissionService } from '../src/modules/permissions/permission.service';

describe('AuthContextService', () => {
  let service: AuthContextService;
  let repository: jest.Mocked<AuthContextRepository>;
  let permissionService: jest.Mocked<Pick<PermissionService, 'getPermissionKeysForRole'>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthContextService,
        {
          provide: AuthContextRepository,
          useValue: {
            findActiveMembershipContext: jest.fn(),
          },
        },
        {
          provide: PermissionService,
          useValue: {
            getPermissionKeysForRole: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(AuthContextService);
    repository = module.get(AuthContextRepository);
    permissionService = module.get(PermissionService);
  });

  it('resolves current user from active membership and role permissions', async () => {
    repository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });
    permissionService.getPermissionKeysForRole.mockResolvedValue([
      'organization.read',
      'user.read',
    ]);

    const result = await service.resolveCurrentUser('user-id', 'org-id');

    expect(result).toEqual({
      id: 'user-id',
      organizationId: 'org-id',
      membershipId: 'membership-id',
      roles: ['admin'],
      permissions: ['organization.read', 'user.read'],
    });
  });

  it('returns null when membership is not found', async () => {
    repository.findActiveMembershipContext.mockResolvedValue(null);

    const result = await service.resolveCurrentUser('user-id');

    expect(result).toBeNull();
  });
});
