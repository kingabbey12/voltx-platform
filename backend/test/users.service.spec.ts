import { NotFoundException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { UpdateCurrentUserDto } from '../src/modules/users/dto/update-user.dto';
import { UserEntity } from '../src/modules/users/entities/user.entity';
import { UsersRepository } from '../src/modules/users/users.repository';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<UsersRepository>;

  const userEntity: UserEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    email: 'jane.doe@example.com',
    firstName: 'Jane',
    lastName: 'Doe',
    avatarUrl: 'https://cdn.example.com/avatars/jane.png',
    phoneNumber: '+14155552671',
    jobTitle: 'Engineering Manager',
    status: UserStatus.ACTIVE,
    lastLoginAt: null,
    emailVerifiedAt: new Date('2026-07-03T00:00:00.000Z'),
    createdAt: new Date('2026-07-03T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByEmail: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);
  });

  describe('getMe', () => {
    it('returns the current user profile', async () => {
      repository.findById.mockResolvedValue(userEntity);

      const result = await service.getMe(userEntity.id);

      expect(result.email).toBe(userEntity.email);
      expect(result.firstName).toBe('Jane');
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.getMe('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateMe', () => {
    it('updates the current user profile', async () => {
      const dto: UpdateCurrentUserDto = { firstName: 'Janet', jobTitle: 'Director' };
      repository.update.mockResolvedValue({ ...userEntity, ...dto });

      const result = await service.updateMe(userEntity.id, dto);

      expect(result.firstName).toBe('Janet');
      expect(result.jobTitle).toBe('Director');
      expect(repository.update).toHaveBeenCalledWith(userEntity.id, dto);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.update.mockResolvedValue(null);

      await expect(
        service.updateMe('00000000-0000-0000-0000-000000000000', { firstName: 'Missing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('returns user by id', async () => {
      repository.findById.mockResolvedValue(userEntity);

      const result = await service.findOne(userEntity.id);

      expect(result.id).toBe(userEntity.id);
    });

    it('throws NotFoundException when user does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated users', async () => {
      repository.findAll.mockResolvedValue({
        items: [userEntity],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      });

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });
});
