import { NotFoundException } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { CreateOrganizationDto } from '../src/modules/organization/dto/create-organization.dto';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { OrganizationService } from '../src/modules/organization/organization.service';
import { OrganizationEntity } from '../src/modules/organization/entities/organization.entity';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let repository: jest.Mocked<OrganizationRepository>;

  const organizationEntity: OrganizationEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Acme Corporation',
    slug: 'acme-corporation',
    logoUrl: 'https://cdn.example.com/logos/acme.png',
    industry: 'Technology',
    country: 'US',
    timezone: 'America/New_York',
    status: OrganizationStatus.ACTIVE,
    settings: { theme: 'dark' },
    createdAt: new Date('2026-07-03T00:00:00.000Z'),
    updatedAt: new Date('2026-07-03T00:00:00.000Z'),
    deletedAt: null,
  };

  const createDto: CreateOrganizationDto = {
    name: 'Acme Corporation',
    logoUrl: 'https://cdn.example.com/logos/acme.png',
    industry: 'Technology',
    country: 'US',
    timezone: 'America/New_York',
    status: OrganizationStatus.ACTIVE,
    settings: { theme: 'dark' },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrganizationService,
        {
          provide: OrganizationRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findBySlug: jest.fn(),
            isSlugTaken: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrganizationService);
    repository = module.get(OrganizationRepository);
  });

  describe('create', () => {
    it('creates an organization with an auto-generated slug', async () => {
      repository.isSlugTaken.mockResolvedValue(false);
      repository.create.mockResolvedValue(organizationEntity);

      const result = await service.create(createDto);

      expect(result.id).toBe(organizationEntity.id);
      expect(result.slug).toBe('acme-corporation');
      expect(repository.isSlugTaken).toHaveBeenCalledWith('acme-corporation');
      expect(repository.create).toHaveBeenCalledWith({
        name: createDto.name,
        slug: 'acme-corporation',
        logoUrl: createDto.logoUrl,
        industry: createDto.industry,
        country: createDto.country,
        timezone: createDto.timezone,
        status: createDto.status,
        settings: createDto.settings,
      });
    });

    it('appends numeric suffix when generated slug already exists', async () => {
      repository.isSlugTaken.mockImplementation((slug: string) =>
        Promise.resolve(slug === 'acme-corporation'),
      );
      repository.create.mockResolvedValue({
        ...organizationEntity,
        slug: 'acme-corporation-2',
      });

      const result = await service.create(createDto);

      expect(result.slug).toBe('acme-corporation-2');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ slug: 'acme-corporation-2' }),
      );
    });
  });

  describe('findOne', () => {
    it('returns organization by id', async () => {
      repository.findById.mockResolvedValue(organizationEntity);

      const result = await service.findOne(organizationEntity.id);

      expect(result.slug).toBe('acme-corporation');
    });

    it('throws NotFoundException when organization does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('returns paginated organizations', async () => {
      repository.findAll.mockResolvedValue({
        items: [organizationEntity],
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

  describe('update', () => {
    it('updates an organization', async () => {
      repository.update.mockResolvedValue({ ...organizationEntity, name: 'Acme Inc.' });

      const result = await service.update(organizationEntity.id, { name: 'Acme Inc.' });

      expect(result.name).toBe('Acme Inc.');
    });

    it('throws NotFoundException when organization does not exist', async () => {
      repository.update.mockResolvedValue(null);

      await expect(
        service.update('00000000-0000-0000-0000-000000000000', { name: 'Missing' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('soft deletes an organization', async () => {
      repository.softDelete.mockResolvedValue({
        ...organizationEntity,
        deletedAt: new Date('2026-07-03T01:00:00.000Z'),
      });

      const result = await service.remove(organizationEntity.id);

      expect(result.id).toBe(organizationEntity.id);
    });

    it('throws NotFoundException when organization does not exist', async () => {
      repository.softDelete.mockResolvedValue(null);

      await expect(service.remove('00000000-0000-0000-0000-000000000000')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
