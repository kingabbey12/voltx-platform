import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { OrganizationStatus } from '@prisma/client';
import { PrismaService } from '../src/database/prisma.service';
import { OrganizationEntity } from '../src/modules/organization/entities/organization.entity';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { PlatformOrganizationService } from '../src/modules/platform/organizations/platform-organization.service';

function makeOrganizationEntity(overrides: Partial<OrganizationEntity> = {}): OrganizationEntity {
  const entity = new OrganizationEntity();
  Object.assign(entity, {
    id: 'org-1',
    name: 'Acme',
    slug: 'acme',
    logoUrl: null,
    email: null,
    website: null,
    industry: null,
    country: null,
    state: null,
    city: null,
    companySize: null,
    primaryGoals: [],
    currency: null,
    language: null,
    phone: null,
    timezone: 'UTC',
    status: OrganizationStatus.ACTIVE,
    settings: {},
    onboardingCompletedAt: null,
    parentOrganizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  });
  return entity;
}

describe('PlatformOrganizationService', () => {
  let service: PlatformOrganizationService;
  let organizationRepository: jest.Mocked<OrganizationRepository>;
  let prisma: {
    system: {
      organization: { findFirst: jest.Mock };
      membership: { count: jest.Mock; groupBy: jest.Mock };
    };
  };

  beforeEach(async () => {
    prisma = {
      system: {
        organization: { findFirst: jest.fn() },
        membership: { count: jest.fn(), groupBy: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformOrganizationService,
        { provide: OrganizationRepository, useValue: { searchUnscoped: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PlatformOrganizationService);
    organizationRepository = module.get(OrganizationRepository);
  });

  it('searches across every organization and attaches member counts', async () => {
    organizationRepository.searchUnscoped.mockResolvedValue({
      items: [makeOrganizationEntity({ id: 'org-1' }), makeOrganizationEntity({ id: 'org-2' })],
      total: 2,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    prisma.system.membership.groupBy.mockResolvedValue([
      { organizationId: 'org-1', _count: { _all: 5 } },
      { organizationId: 'org-2', _count: { _all: 2 } },
    ]);

    const result = await service.search({ page: 1, limit: 20 });

    expect(prisma.system.membership.groupBy).toHaveBeenCalledWith({
      by: ['organizationId'],
      where: { organizationId: { in: ['org-1', 'org-2'] } },
      _count: { _all: true },
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[0].memberCount).toBe(5);
    expect(result.items[1].memberCount).toBe(2);
  });

  it('defaults member count to 0 for an organization missing from the groupBy result', async () => {
    organizationRepository.searchUnscoped.mockResolvedValue({
      items: [makeOrganizationEntity({ id: 'org-3' })],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    prisma.system.membership.groupBy.mockResolvedValue([]);

    const result = await service.search({ page: 1, limit: 20 });

    expect(result.items[0].memberCount).toBe(0);
  });

  it('throws NotFoundException for an unknown organization id', async () => {
    prisma.system.organization.findFirst.mockResolvedValue(null);
    await expect(service.getDetail('not-real')).rejects.toThrow(NotFoundException);
  });

  it('returns organization detail with a member count', async () => {
    prisma.system.organization.findFirst.mockResolvedValue({
      id: 'org-1',
      name: 'Acme',
      slug: 'acme',
      logoUrl: null,
      email: 'ops@acme.test',
      website: null,
      industry: null,
      country: null,
      state: null,
      city: null,
      companySize: null,
      primaryGoals: [],
      currency: null,
      language: null,
      phone: null,
      timezone: 'UTC',
      status: OrganizationStatus.ACTIVE,
      settings: {},
      onboardingCompletedAt: null,
      parentOrganizationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    prisma.system.membership.count.mockResolvedValue(3);

    const result = await service.getDetail('org-1');

    expect(result.id).toBe('org-1');
    expect(result.memberCount).toBe(3);
    expect(result.email).toBe('ops@acme.test');
  });
});
