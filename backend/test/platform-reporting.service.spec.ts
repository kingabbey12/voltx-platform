import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { PlatformReportingService } from '../src/modules/platform/reporting/platform-reporting.service';

function makeOrg(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'org-1',
    name: 'Acme',
    slug: 'acme',
    status: 'ACTIVE',
    parentOrganizationId: null,
    ...overrides,
  };
}

describe('PlatformReportingService', () => {
  let service: PlatformReportingService;
  let prisma: {
    system: {
      organization: {
        findUnique: jest.Mock;
        findMany: jest.Mock;
        count: jest.Mock;
      };
    };
  };

  beforeEach(async () => {
    prisma = {
      system: {
        organization: { findUnique: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformReportingService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PlatformReportingService);
  });

  it('throws NotFoundException for a non-existent organization', async () => {
    prisma.system.organization.findUnique.mockResolvedValue(null);
    await expect(service.getOrganizationHierarchy('missing-org')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('returns parent and subsidiaries for an organization with both', async () => {
    const parentOrg = makeOrg({ id: 'org-parent' });
    const childOrg = makeOrg({ id: 'org-1', parentOrganizationId: 'org-parent' });

    prisma.system.organization.findUnique.mockImplementation(
      ({ where: { id } }: { where: { id: string } }) =>
        Promise.resolve(id === 'org-1' ? childOrg : id === 'org-parent' ? parentOrg : null),
    );
    prisma.system.organization.findMany.mockResolvedValue([]);
    prisma.system.organization.count.mockResolvedValue(0);

    const result = await service.getOrganizationHierarchy('org-1');

    expect(result.organization.id).toBe('org-1');
    expect(result.parent?.id).toBe('org-parent');
    expect(result.subsidiaries).toEqual([]);
  });

  it('cross-org report with no root returns only top-level organizations', async () => {
    prisma.system.organization.findMany.mockResolvedValue([makeOrg({ id: 'org-top' })]);
    prisma.system.organization.count.mockResolvedValue(2);

    const result = await service.getCrossOrgReport();

    expect(prisma.system.organization.findMany).toHaveBeenCalledWith({
      where: { parentOrganizationId: null },
    });
    expect(result).toEqual([expect.objectContaining({ id: 'org-top', subsidiaryCount: 2 })]);
  });

  it('cross-org report with a root walks the full subtree, not just one level', async () => {
    const root = makeOrg({ id: 'root' });
    prisma.system.organization.findUnique.mockResolvedValue(root);

    // root -> child -> grandchild (2 levels deep)
    prisma.system.organization.findMany
      .mockResolvedValueOnce([{ id: 'child' }]) // children of [root]
      .mockResolvedValueOnce([{ id: 'grandchild' }]) // children of [child]
      .mockResolvedValueOnce([]) // children of [grandchild]
      .mockResolvedValueOnce([
        makeOrg({ id: 'root' }),
        makeOrg({ id: 'child', parentOrganizationId: 'root' }),
        makeOrg({ id: 'grandchild', parentOrganizationId: 'child' }),
      ]); // final findMany({ id: { in: subtreeIds } })
    prisma.system.organization.count.mockResolvedValue(0);

    const result = await service.getCrossOrgReport('root');

    expect(result.map((o) => o.id).sort()).toEqual(['child', 'grandchild', 'root']);
  });

  it('throws NotFoundException when the requested root organization does not exist', async () => {
    prisma.system.organization.findUnique.mockResolvedValue(null);
    await expect(service.getCrossOrgReport('missing-root')).rejects.toThrow(NotFoundException);
  });
});
