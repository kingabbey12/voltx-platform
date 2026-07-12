import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { OrganizationStatus } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { CreateOrganizationDto } from '../src/modules/organization/dto/create-organization.dto';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { OrganizationService } from '../src/modules/organization/organization.service';
import { OrganizationEntity } from '../src/modules/organization/entities/organization.entity';

describe('OrganizationService', () => {
  let service: OrganizationService;
  let repository: jest.Mocked<OrganizationRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  const organizationEntity: OrganizationEntity = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Acme Corporation',
    slug: 'acme-corporation',
    logoUrl: 'https://cdn.example.com/logos/acme.png',
    email: 'hello@acme.com',
    website: 'https://acme.com',
    industry: 'Technology',
    country: 'US',
    state: null,
    city: null,
    companySize: null,
    primaryGoals: [],
    currency: 'USD',
    language: 'en',
    phone: null,
    timezone: 'America/New_York',
    status: OrganizationStatus.ACTIVE,
    settings: { theme: 'dark' },
    onboardingCompletedAt: null,
    parentOrganizationId: null,
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
            completeOnboarding: jest.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            assertOrganizationAccess: jest.fn(),
            getOrThrow: jest.fn().mockReturnValue({
              organizationId: organizationEntity.id,
              userId: 'user-id',
              membershipId: 'membership-id',
              requestId: 'request-id',
            }),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OrganizationService);
    repository = module.get(OrganizationRepository);
    tenantContextService = module.get(TenantContextService);
  });

  describe('create', () => {
    it('creates an organization with an auto-generated slug', async () => {
      repository.isSlugTaken.mockResolvedValue(false);
      repository.create.mockResolvedValue(organizationEntity);

      const result = await service.create(createDto);

      expect(result.id).toBe(organizationEntity.id);
      expect(result.slug).toBe('acme-corporation');
    });
  });

  describe('findOne', () => {
    it('returns organization by id', async () => {
      repository.findById.mockResolvedValue(organizationEntity);

      const result = await service.findOne(organizationEntity.id);

      expect(result.slug).toBe('acme-corporation');
      expect(tenantContextService.assertOrganizationAccess).toHaveBeenCalledWith(
        organizationEntity.id,
      );
    });

    it('throws ForbiddenException for cross-tenant access', async () => {
      tenantContextService.assertOrganizationAccess.mockImplementation(() => {
        throw new ForbiddenException('Cross-tenant access is forbidden');
      });

      await expect(service.findOne('00000000-0000-0000-0000-000000000001')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when organization does not exist', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne(organizationEntity.id)).rejects.toThrow(NotFoundException);
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
  });

  describe('completeOnboarding', () => {
    it('marks onboarding complete', async () => {
      repository.completeOnboarding.mockResolvedValue({
        ...organizationEntity,
        onboardingCompletedAt: new Date('2026-07-07T00:00:00.000Z'),
      });

      const result = await service.completeOnboarding(organizationEntity.id);

      expect(result.onboardingCompletedAt).toBe('2026-07-07T00:00:00.000Z');
      expect(tenantContextService.assertOrganizationAccess).toHaveBeenCalledWith(
        organizationEntity.id,
      );
    });

    it('throws NotFoundException when organization does not exist', async () => {
      repository.completeOnboarding.mockResolvedValue(null);

      await expect(service.completeOnboarding(organizationEntity.id)).rejects.toThrow(
        NotFoundException,
      );
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
  });
});
