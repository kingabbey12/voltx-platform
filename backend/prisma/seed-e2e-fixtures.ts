/**
 * Restricted-role fixtures for the authenticated Playwright suite.
 *
 * The browser permission matrix signs in as CRM-limited, Finance-limited and
 * approval-restricted identities. Without these rows those sign-ins cannot
 * succeed, and a sign-in helper that fails open will quietly re-verify the
 * owner instead — which is how a permission-matrix test passes while proving
 * nothing. Provisioning the identities is half the fix; the other half is the
 * helper asserting the identity it actually got (see e2e/authenticated/sign-in.ts).
 *
 * Idempotent: safe to re-run against an existing environment.
 *
 *   OWNER_EMAIL=uiqa@local.test DATABASE_URL=... npx tsx prisma/seed-e2e-fixtures.ts
 */
import { MembershipStatus, PrismaClient, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/utils/password.util';

/** Test-only credential. Must match E2E_FIXTURE_PASSWORD in the Playwright helper. */
const FIXTURE_PASSWORD = process.env.E2E_FIXTURE_PASSWORD ?? 'e2e-Runner-Password-1';
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'uiqa@local.test';

/** Permissions every fixture needs simply to load the shell. */
const BASE_PERMISSIONS = ['organization.read', 'user.read', 'ai.agent.run'];

interface FixtureRole {
  email: string;
  roleKey: string;
  firstName: string;
  permissions: string[];
}

/**
 * Each fixture is defined by what it must NOT be able to see, because that is
 * what the matrix asserts:
 *   crm      — sales visible, finance absent
 *   finance  — finance visible, sales absent
 *   approval — neither approval reading nor deciding
 */
const FIXTURES: FixtureRole[] = [
  {
    email: 'e2e-executive-crm@local.voltx.test',
    roleKey: 'e2e-executive-crm',
    firstName: 'CRM',
    permissions: [
      ...BASE_PERMISSIONS,
      'sales.company.read',
      'sales.contact.read',
      'sales.lead.read',
      'sales.opportunity.read',
      'sales.activity.read',
    ],
  },
  {
    email: 'e2e-executive-finance@local.voltx.test',
    roleKey: 'e2e-executive-finance',
    firstName: 'Finance',
    permissions: [
      ...BASE_PERMISSIONS,
      'finance.transaction.read',
      'finance.budget.read',
      'finance.report.read',
    ],
  },
  {
    email: 'e2e-executive-approval@local.voltx.test',
    roleKey: 'e2e-executive-approval',
    firstName: 'Approval',
    // Deliberately carries neither ai.approval.read/decide nor workflow.approve.
    permissions: [...BASE_PERMISSIONS, 'sales.opportunity.read'],
  },
];

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const owner = await prisma.user.findUnique({
      where: { email: OWNER_EMAIL },
      include: { memberships: true },
    });
    if (!owner || owner.memberships.length === 0) {
      throw new Error(
        `Owner "${OWNER_EMAIL}" not found or has no membership. Run scripts/dev-authenticated-env.sh first.`,
      );
    }
    // Fixtures share the owner's organization so the matrix exercises
    // permission filtering rather than tenant isolation, which is covered
    // separately by the backend e2e suites.
    const organizationId = owner.memberships[0].organizationId;
    const passwordHash = await hashPassword(FIXTURE_PASSWORD);

    for (const fixture of FIXTURES) {
      const permissions = await prisma.permission.findMany({
        where: { key: { in: fixture.permissions } },
      });
      const missing = fixture.permissions.filter(
        (key) => !permissions.some((permission) => permission.key === key),
      );
      if (missing.length > 0) {
        throw new Error(
          `Unknown permission(s) for ${fixture.roleKey}: ${missing.join(', ')}. Run prisma:seed first.`,
        );
      }

      const role = await prisma.role.upsert({
        where: { key: fixture.roleKey },
        update: { organizationId },
        create: {
          key: fixture.roleKey,
          name: fixture.roleKey,
          description: `Playwright fixture role (${fixture.firstName}-limited)`,
          organizationId,
        },
      });
      // Rewrite the grant set so re-running always converges on the declared
      // permissions rather than accumulating stale ones.
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      });

      const user = await prisma.user.upsert({
        where: { email: fixture.email },
        update: { passwordHash, status: UserStatus.ACTIVE },
        create: {
          email: fixture.email,
          firstName: fixture.firstName,
          lastName: 'Fixture',
          passwordHash,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      const membership = await prisma.membership.findFirst({
        where: { userId: user.id, organizationId },
      });
      if (membership) {
        await prisma.membership.update({
          where: { id: membership.id },
          data: { roleId: role.id, status: MembershipStatus.ACTIVE },
        });
      } else {
        await prisma.membership.create({
          data: {
            userId: user.id,
            organizationId,
            roleId: role.id,
            status: MembershipStatus.ACTIVE,
          },
        });
      }

      console.log(`  ✓ ${fixture.email} (${permissions.length} permissions)`);
    }
    console.log(`Provisioned ${FIXTURES.length} restricted-role fixtures in org ${organizationId}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
