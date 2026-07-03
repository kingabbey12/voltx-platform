import { Prisma } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';

function getTenantOrganizationId(tenantContextService: TenantContextService): string | null {
  return tenantContextService.get()?.organizationId ?? null;
}

function withOrganizationScope<T extends { where?: unknown }>(args: T, organizationId: string): T {
  const existingWhere = (args.where ?? {}) as Prisma.OrganizationWhereInput;
  return {
    ...args,
    where: {
      AND: [existingWhere, { id: organizationId }],
    },
  };
}

function withMembershipScope<T extends { where?: unknown }>(args: T, organizationId: string): T {
  const existingWhere = (args.where ?? {}) as Prisma.MembershipWhereInput;
  return {
    ...args,
    where: {
      AND: [existingWhere, { organizationId }],
    },
  };
}

function withTenantUserScope<T extends { where?: unknown }>(args: T, organizationId: string): T {
  const existingWhere = (args.where ?? {}) as Prisma.UserWhereInput;
  return {
    ...args,
    where: {
      AND: [
        existingWhere,
        {
          memberships: {
            some: {
              organizationId,
              status: 'ACTIVE',
            },
          },
        },
      ],
    },
  };
}

export function createTenantPrismaExtension(tenantContextService: TenantContextService) {
  return Prisma.defineExtension({
    query: {
      organization: {
        findMany({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withOrganizationScope(args, organizationId));
          }
          return query(args);
        },
        findFirst({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withOrganizationScope(args, organizationId));
          }
          return query(args);
        },
        count({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withOrganizationScope(args, organizationId));
          }
          return query(args);
        },
        update({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            args.where = { id: organizationId };
          }
          return query(args);
        },
        updateMany({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withOrganizationScope(args, organizationId));
          }
          return query(args);
        },
        delete({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            args.where = { id: organizationId };
          }
          return query(args);
        },
        deleteMany({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withOrganizationScope(args, organizationId));
          }
          return query(args);
        },
      },
      user: {
        findMany({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withTenantUserScope(args, organizationId));
          }
          return query(args);
        },
        findFirst({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withTenantUserScope(args, organizationId));
          }
          return query(args);
        },
        count({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withTenantUserScope(args, organizationId));
          }
          return query(args);
        },
      },
      membership: {
        findMany({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withMembershipScope(args, organizationId));
          }
          return query(args);
        },
        findFirst({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withMembershipScope(args, organizationId));
          }
          return query(args);
        },
        count({ args, query }) {
          const organizationId = getTenantOrganizationId(tenantContextService);
          if (organizationId) {
            return query(withMembershipScope(args, organizationId));
          }
          return query(args);
        },
      },
    },
  });
}
