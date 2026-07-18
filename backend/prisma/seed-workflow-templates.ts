/**
 * CLI wrapper around the canonical workflow-template seeder in
 * src/database/seed/workflow-templates.seed.ts. Kept so the existing
 * `pnpm prisma:seed:templates` script and test imports keep working; the
 * seed data and logic live in src/ (single source of truth) so the running
 * application can boot-time auto-repair them too.
 */
import { PrismaClient } from '@prisma/client';
import {
  seedWorkflowTemplates as seedWorkflowTemplatesWith,
  TEMPLATE_SEEDS,
} from '../src/database/seed/workflow-templates.seed';

const prisma = new PrismaClient();

async function seedWorkflowTemplates(): Promise<void> {
  await seedWorkflowTemplatesWith(prisma);
}

if (require.main === module) {
  seedWorkflowTemplates()
    .then(async () => {
      await prisma.$disconnect();
    })
    .catch(async (error: unknown) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}

export { seedWorkflowTemplates, TEMPLATE_SEEDS, prisma as workflowTemplatesSeedClient };
