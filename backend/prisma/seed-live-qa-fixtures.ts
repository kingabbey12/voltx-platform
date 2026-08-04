/**
 * Live QA fixtures — provisions a clearly-marked, self-contained QA
 * organization on a *deployed* database so authenticated QA can run against
 * the real environment.
 *
 * This is deliberately NOT seed-e2e-fixtures.ts. That script attaches its
 * restricted roles to an existing owner's organization, which is exactly the
 * wrong shape for a shared database: pointed at production it would graft test
 * memberships onto a real customer tenant. This one owns every row it touches.
 *
 * Safety rails, all of which fail closed:
 *   1. Refuses to run without ALLOW_LIVE_QA_FIXTURES=true.
 *   2. Refuses unless the organization name contains "QA" or "TEST".
 *   3. Refuses to touch any user that already exists outside this QA org, so a
 *      collision with a real account aborts instead of overwriting it.
 *   4. Emails live under a reserved .test TLD (RFC 2606) and can never receive
 *      real mail.
 *   5. Cleanup only ever deletes rows inside a QA/TEST-named organization.
 *
 * Idempotent: safe to re-run. Never prints the password.
 *
 *   ALLOW_LIVE_QA_FIXTURES=true E2E_FIXTURE_PASSWORD=... DATABASE_URL=... \
 *     pnpm prisma:seed:live-qa
 *
 *   ALLOW_LIVE_QA_FIXTURES=true DATABASE_URL=... \
 *     pnpm prisma:seed:live-qa -- --cleanup
 *
 * A second isolated tenant (for cross-tenant checks) is just a second run with
 * a different LIVE_QA_ORG_NAME.
 */
import { MembershipStatus, PrismaClient, UserStatus } from '@prisma/client';
import { hashPassword } from '../src/modules/auth/utils/password.util';

const ORG_NAME = process.env.LIVE_QA_ORG_NAME ?? 'Voltx Live QA';
const EMAIL_DOMAIN = process.env.LIVE_QA_EMAIL_DOMAIN ?? 'qa.usevoltx.test';

/** Permissions every fixture needs simply to load the shell. */
const BASE_PERMISSIONS = ['organization.read', 'user.read', 'ai.agent.run'];

interface FixtureRole {
  slug: string;
  roleKey: string;
  firstName: string;
  /** Undefined means "the seeded owner role" — the full catalogue. */
  permissions?: string[];
}

/**
 * Mirrors the local matrix in seed-e2e-fixtures.ts. Each restricted fixture is
 * defined by what it must NOT reach, because that is what the matrix asserts.
 */
const FIXTURES: FixtureRole[] = [
  { slug: 'owner', roleKey: 'owner', firstName: 'QA Owner' },
  {
    slug: 'crm',
    roleKey: 'live-qa-crm',
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
    slug: 'finance',
    roleKey: 'live-qa-finance',
    firstName: 'Finance',
    permissions: [
      ...BASE_PERMISSIONS,
      'finance.transaction.read',
      'finance.budget.read',
      'finance.report.read',
    ],
  },
  {
    slug: 'approval',
    roleKey: 'live-qa-approval',
    firstName: 'Approval',
    // Deliberately carries neither ai.approval.read/decide nor workflow.approve.
    permissions: [...BASE_PERMISSIONS, 'sales.opportunity.read'],
  },
];

const emailFor = (slug: string): string => `voltx-live-qa-${slug}@${EMAIL_DOMAIN}`;

/** Deterministic, collision-resistant, and obvious in a database browser. */
const slugFor = (name: string): string =>
  `live-qa-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;

function assertSafeToRun(): void {
  if (process.env.ALLOW_LIVE_QA_FIXTURES !== 'true') {
    throw new Error(
      'Refusing to run: set ALLOW_LIVE_QA_FIXTURES=true to confirm you intend to ' +
        'write QA fixtures to the database this DATABASE_URL points at.',
    );
  }
  if (!/QA|TEST/i.test(ORG_NAME)) {
    throw new Error(
      `Refusing to run: LIVE_QA_ORG_NAME ("${ORG_NAME}") must contain "QA" or "TEST" so ` +
        'QA data is unmistakable and cleanup can never target a real organization.',
    );
  }
}

async function seed(prisma: PrismaClient): Promise<void> {
  const password = process.env.E2E_FIXTURE_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error(
      'E2E_FIXTURE_PASSWORD must be set to at least 12 characters. It is never ' +
        'defaulted here: a predictable password on a deployed database is a real account.',
    );
  }

  const slug = slugFor(ORG_NAME);
  const organization = await prisma.organization.upsert({
    where: { slug },
    update: { name: ORG_NAME },
    create: {
      name: ORG_NAME,
      slug,
      // Pre-completed so QA lands on the dashboard, not the onboarding wizard.
      onboardingCompletedAt: new Date(),
    },
  });
  console.log(`Organization "${ORG_NAME}" (${organization.id})`);

  const passwordHash = await hashPassword(password);

  for (const fixture of FIXTURES) {
    const email = emailFor(fixture.slug);

    // Guard 3: never adopt or mutate an account that isn't already ours.
    const existing = await prisma.user.findUnique({
      where: { email },
      include: { memberships: true },
    });
    if (
      existing &&
      existing.memberships.length > 0 &&
      !existing.memberships.some((m) => m.organizationId === organization.id)
    ) {
      throw new Error(
        `Refusing to touch ${email}: it already belongs to a different organization. ` +
          'Resolve this by hand rather than letting a QA seeder overwrite it.',
      );
    }

    // Role.key is globally unique, not unique-per-organization. Upserting a
    // bare "live-qa-crm" for a second tenant therefore does not create a second
    // role — it reassigns the first tenant's role to the new org, quietly
    // stripping the original. Namespacing by slug keeps the two tenants'
    // matrices genuinely independent, which is the whole point of seeding two.
    const scopedRoleKey = `${fixture.roleKey}--${slug}`;

    let roleId: string;
    if (fixture.permissions) {
      const permissions = await prisma.permission.findMany({
        where: { key: { in: fixture.permissions } },
      });
      const missing = fixture.permissions.filter(
        (key) => !permissions.some((permission) => permission.key === key),
      );
      if (missing.length > 0) {
        throw new Error(
          `Unknown permission(s) for ${fixture.roleKey}: ${missing.join(', ')}. ` +
            'The RBAC catalogue is seeded on boot; if these are genuinely absent the ' +
            'deployment is older than the permissions it needs.',
        );
      }

      const role = await prisma.role.upsert({
        where: { key: scopedRoleKey },
        update: { organizationId: organization.id },
        create: {
          key: scopedRoleKey,
          name: fixture.roleKey,
          description: `Live QA fixture role (${fixture.firstName}-limited)`,
          organizationId: organization.id,
        },
      });
      // Rewrite rather than append so re-running converges on the declared set.
      await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
      await prisma.rolePermission.createMany({
        data: permissions.map((permission) => ({
          roleId: role.id,
          permissionId: permission.id,
        })),
      });
      roleId = role.id;
    } else {
      const owner = await prisma.role.findUnique({ where: { key: fixture.roleKey } });
      if (!owner) {
        throw new Error(
          `The seeded "${fixture.roleKey}" role is missing. RBAC has not been seeded on this database.`,
        );
      }
      roleId = owner.id;
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: { passwordHash, status: UserStatus.ACTIVE },
      create: {
        email,
        firstName: fixture.firstName,
        lastName: 'LiveQA',
        passwordHash,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(),
      },
    });

    const membership = await prisma.membership.findFirst({
      where: { userId: user.id, organizationId: organization.id },
    });
    if (membership) {
      await prisma.membership.update({
        where: { id: membership.id },
        data: { roleId, status: MembershipStatus.ACTIVE },
      });
    } else {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          roleId,
          status: MembershipStatus.ACTIVE,
        },
      });
    }

    console.log(`  ✓ ${email} (${fixture.permissions ? scopedRoleKey : fixture.roleKey})`);
  }

  console.log(`Provisioned ${FIXTURES.length} live QA identities in "${ORG_NAME}".`);
}

async function cleanup(prisma: PrismaClient): Promise<void> {
  const slug = slugFor(ORG_NAME);
  const organization = await prisma.organization.findUnique({ where: { slug } });
  if (!organization) {
    console.log(`Nothing to clean up — no organization with slug "${slug}".`);
    return;
  }
  // Guard 5, restated against the row we actually loaded rather than the env var.
  if (!/QA|TEST/i.test(organization.name)) {
    throw new Error(
      `Refusing to delete "${organization.name}": it is not marked QA or TEST.`,
    );
  }

  const emails = FIXTURES.map((fixture) => emailFor(fixture.slug));
  const users = await prisma.user.findMany({ where: { email: { in: emails } } });

  await prisma.membership.deleteMany({ where: { organizationId: organization.id } });
  await prisma.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await prisma.rolePermission.deleteMany({
    where: { role: { organizationId: organization.id } },
  });
  await prisma.role.deleteMany({ where: { organizationId: organization.id } });
  await prisma.organization.delete({ where: { id: organization.id } });

  console.log(`Removed "${organization.name}" and ${users.length} QA identities.`);
}

async function main(): Promise<void> {
  assertSafeToRun();
  const prisma = new PrismaClient();
  try {
    if (process.argv.includes('--cleanup')) {
      await cleanup(prisma);
    } else {
      await seed(prisma);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
