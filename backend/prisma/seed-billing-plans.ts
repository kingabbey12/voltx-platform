/**
 * CLI wrapper around the canonical billing-plan seeder in
 * src/database/seed/billing-plans.seed.ts. Kept so `pnpm prisma:seed:*`
 * and the existing test imports keep working; the actual seed data and
 * logic live in src/ (single source of truth) so the running application
 * can boot-time auto-repair them too.
 */
import { PrismaClient } from '@prisma/client';
import {
  seedBillingPlans as seedBillingPlansWith,
  PLAN_SEEDS,
  FEATURE_SEEDS,
} from '../src/database/seed/billing-plans.seed';

const prisma = new PrismaClient();

async function seedBillingPlans(): Promise<void> {
  await seedBillingPlansWith(prisma);
}

if (require.main === module) {
  seedBillingPlans()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { seedBillingPlans, PLAN_SEEDS, FEATURE_SEEDS, prisma as billingPlansSeedClient };
