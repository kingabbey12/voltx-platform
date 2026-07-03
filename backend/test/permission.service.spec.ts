import { Test, TestingModule } from '@nestjs/testing';
import { PermissionRepository } from '../src/modules/permissions/permission.repository';
import { PermissionService } from '../src/modules/permissions/permission.service';

describe('PermissionService', () => {
  let service: PermissionService;
  let repository: jest.Mocked<PermissionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionService,
        {
          provide: PermissionRepository,
          useValue: {
            findAll: jest.fn(),
            findPermissionKeysByRoleId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PermissionService);
    repository = module.get(PermissionRepository);
  });

  it('returns permission keys for a role', async () => {
    repository.findPermissionKeysByRoleId.mockResolvedValue(['user.read', 'user.update']);

    const result = await service.getPermissionKeysForRole('role-id');

    expect(result).toEqual(['user.read', 'user.update']);
  });
});
