/**
 * The single seed entrypoint the deploy pipeline runs (`pnpm prisma:seed`,
 * invoked by deploy.yml after `prisma migrate deploy`). It must produce a
 * database a fresh production deployment can actually operate on, which
 * means all three catalogs — not just RBAC:
 *
 * - RBAC permissions/roles: `register()` fails with Prisma P2025 (missing
 *   `owner` role) without them, and every authenticated request 403s.
 * - Billing plans/features: registration commits the user/org then throws
 *   (startTrialSubscription looks up the `professional` plan) without them.
 * - Workflow templates: the template gallery is empty without them.
 *
 * The RBAC and billing catalogs/seeders now live in src/database/seed so
 * the running application can boot-time auto-repair them (see
 * DatabaseSeedBootstrapService); this file is the CLI/deploy entrypoint
 * that also seeds workflow templates. All are idempotent upserts — safe
 * to re-run on every deploy.
 */
import { PrismaClient } from '@prisma/client';
import { seedRbac as seedRbacWith } from '../src/database/seed/rbac.seed';
import { seedBillingPlans, billingPlansSeedClient } from './seed-billing-plans';
import { seedWorkflowTemplates, workflowTemplatesSeedClient } from './seed-workflow-templates';

const prisma = new PrismaClient();

/** Re-exported for the e2e test helper (`test/helpers/users-test.helper.ts`),
 * which seeds RBAC against its own client. */
async function seedRbac(client: PrismaClient = prisma): Promise<void> {
  await seedRbacWith(client);
}

async function main(): Promise<void> {
  await seedRbac();
  await seedBillingPlans();
  await seedWorkflowTemplates();
}

if (require.main === module) {
  main()
    .then(async () => {
      await Promise.all([
        prisma.$disconnect(),
        billingPlansSeedClient.$disconnect(),
        workflowTemplatesSeedClient.$disconnect(),
      ]);
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await Promise.all([
        prisma.$disconnect(),
        billingPlansSeedClient.$disconnect(),
        workflowTemplatesSeedClient.$disconnect(),
      ]);
      process.exit(1);
    });
}

export { seedRbac };
