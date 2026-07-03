import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RoleRepository } from '../src/modules/roles/role.repository';
import { RoleService } from '../src/modules/roles/role.service';

describe('RoleService', () => {
  let service: RoleService;
  let repository: jest.Mocked<RoleRepository>;

  const roleEntity = {
    id: 'role-id',
    key: 'admin',
    name: 'Admin',
    description: 'Administrative access',
    isSystem: true,
    permissionKeys: ['user.read', 'organization.read'],
    createdAt: new Date('2026-07-03T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        {
          provide: RoleRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByKey: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(RoleService);
    repository = module.get(RoleRepository);
  });

  it('returns all roles', async () => {
    repository.findAll.mockResolvedValue([roleEntity]);

    const result = await service.findAll();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.key).toBe('admin');
  });

  it('returns role by id', async () => {
    repository.findById.mockResolvedValue(roleEntity);

    const result = await service.findOne('role-id');

    expect(result.key).toBe('admin');
  });

  it('throws NotFoundException when role does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne('missing-id')).rejects.toThrow(NotFoundException);
  });
});
