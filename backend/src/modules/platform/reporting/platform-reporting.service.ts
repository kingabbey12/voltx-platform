import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  parentOrganizationId: string | null;
  subsidiaryCount: number;
}

export interface OrganizationHierarchyResult {
  organization: OrganizationSummary;
  parent: OrganizationSummary | null;
  subsidiaries: OrganizationSummary[];
}

/**
 * Platform-admin-only, cross-organization reads. `Organization.parentOrganizationId`
 * is otherwise never consulted anywhere in the request path — this is the
 * one place it means anything, gated entirely by PLATFORM_ADMIN_GUARDS
 * (never AUTH_GUARDS), so a subsidiary's own admin has no route into this
 * data (see organization-hierarchy.e2e-spec.ts for the load-bearing
 * regression proving that).
 */
@Injectable()
export class PlatformReportingService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrganizationHierarchy(organizationId: string): Promise<OrganizationHierarchyResult> {
    const organization = await this.prisma.system.organization.findUnique({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const [parent, subsidiaries] = await Promise.all([
      organization.parentOrganizationId
        ? this.prisma.system.organization.findUnique({
            where: { id: organization.parentOrganizationId },
          })
        : Promise.resolve(null),
      this.prisma.system.organization.findMany({ where: { parentOrganizationId: organizationId } }),
    ]);

    const [subsidiaryCount, parentSubsidiaryCount] = await Promise.all([
      this.prisma.system.organization.count({ where: { parentOrganizationId: organizationId } }),
      parent
        ? this.prisma.system.organization.count({ where: { parentOrganizationId: parent.id } })
        : Promise.resolve(0),
    ]);

    return {
      organization: toSummary(organization, subsidiaryCount),
      parent: parent ? toSummary(parent, parentSubsidiaryCount) : null,
      subsidiaries: await Promise.all(
        subsidiaries.map(async (sub) =>
          toSummary(
            sub,
            await this.prisma.system.organization.count({
              where: { parentOrganizationId: sub.id },
            }),
          ),
        ),
      ),
    };
  }

  /**
   * With no root, returns every top-level organization (no parent) with
   * its direct subsidiary count. With a root, returns every organization
   * in that root's subtree (recursively walked, not just one level).
   */
  async getCrossOrgReport(rootOrganizationId?: string): Promise<OrganizationSummary[]> {
    if (!rootOrganizationId) {
      const topLevel = await this.prisma.system.organization.findMany({
        where: { parentOrganizationId: null },
      });
      return Promise.all(
        topLevel.map(async (org) =>
          toSummary(
            org,
            await this.prisma.system.organization.count({
              where: { parentOrganizationId: org.id },
            }),
          ),
        ),
      );
    }

    const root = await this.prisma.system.organization.findUnique({
      where: { id: rootOrganizationId },
    });
    if (!root) {
      throw new NotFoundException('Organization not found');
    }

    const subtreeIds = [root.id];
    let frontier = [root.id];
    while (frontier.length > 0) {
      const children = await this.prisma.system.organization.findMany({
        where: { parentOrganizationId: { in: frontier } },
        select: { id: true },
      });
      frontier = children.map((c) => c.id).filter((id) => !subtreeIds.includes(id));
      subtreeIds.push(...frontier);
    }

    const organizations = await this.prisma.system.organization.findMany({
      where: { id: { in: subtreeIds } },
    });
    return Promise.all(
      organizations.map(async (org) =>
        toSummary(
          org,
          await this.prisma.system.organization.count({ where: { parentOrganizationId: org.id } }),
        ),
      ),
    );
  }
}

function toSummary(
  organization: {
    id: string;
    name: string;
    slug: string;
    status: string;
    parentOrganizationId: string | null;
  },
  subsidiaryCount: number,
): OrganizationSummary {
  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    status: organization.status,
    parentOrganizationId: organization.parentOrganizationId,
    subsidiaryCount,
  };
}
