import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, seedRbac } from './rbac.seed';
import { PLAN_SEEDS, seedBillingPlans } from './billing-plans.seed';
import { TEMPLATE_SEEDS, seedWorkflowTemplates } from './workflow-templates.seed';

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 500;

/**
 * Idempotent verify-and-repair of the reference data the app cannot serve
 * without: RBAC roles/permissions (register() looks up the `owner` role),
 * billing plans (startTrialSubscription needs `professional`), and workflow
 * templates. Shared by two callers:
 *
 *  - DatabaseSeedBootstrapService, on every application boot.
 *  - AuthService.register(), lazily, if the owner role is missing at the
 *    moment a user actually signs up.
 *
 * The lazy path is what makes this bulletproof in production: a boot-time
 * seed can silently fail against a cold/suspended Neon database (its first
 * connection wakes the compute; transient errors there previously left
 * roles missing until the next restart, which on a free-tier service may
 * never come). By re-checking at request time — when the database is
 * provably warm — the first registration self-heals the catalog and
 * succeeds. Every repair retries with exponential backoff so a single
 * transient connection error can't defeat it.
 */
@Injectable()
export class SystemSeedService {
  private readonly logger = new Logger(SystemSeedService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Roles + permissions. `register()` depends on the `owner` role existing. */
  async ensureRbac(): Promise<void> {
    await this.ensure(
      'RBAC (roles & permissions)',
      async () => {
        const [roleCount, permissionCount] = await Promise.all([
          this.prisma.system.role.count({ where: { isSystem: true } }),
          this.prisma.system.permission.count(),
        ]);
        return (
          roleCount >= ROLE_DEFINITIONS.length && permissionCount >= PERMISSION_DEFINITIONS.length
        );
      },
      () => seedRbac(this.prisma.system),
    );
  }

  /** Billing plans/features. `startTrialSubscription` needs the `professional` plan. */
  async ensureBillingPlans(): Promise<void> {
    await this.ensure(
      'billing plans',
      async () => (await this.prisma.system.plan.count()) >= PLAN_SEEDS.length,
      () => seedBillingPlans(this.prisma.system),
    );
  }

  /** Workflow templates — not auth-critical, kept complete for a usable fresh DB. */
  async ensureWorkflowTemplates(): Promise<void> {
    await this.ensure(
      'workflow templates',
      async () =>
        (await this.prisma.system.workflowTemplate.count({ where: { isSystem: true } })) >=
        TEMPLATE_SEEDS.length,
      () => seedWorkflowTemplates(this.prisma.system),
    );
  }

  /**
   * Check; if complete, return. Otherwise repair and re-check. Transient
   * errors (cold Neon, a dropped pooled connection) are retried with
   * exponential backoff. Throws only if the data is still incomplete after
   * exhausting retries — callers decide whether that is fatal (register:
   * surface it) or not (boot: log and continue, next attempt retries).
   */
  private async ensure(
    label: string,
    check: () => Promise<boolean>,
    repair: () => Promise<void>,
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        if (await check()) {
          if (attempt > 1) {
            this.logger.log(`Seed integrity: ${label} present after ${attempt} attempt(s)`);
          }
          return;
        }
        this.logger.warn(
          `Seed integrity: ${label} missing/incomplete — seeding (attempt ${attempt})`,
        );
        await repair();
        if (await check()) {
          this.logger.log(`Seed integrity: ${label} seeded successfully`);
          return;
        }
        // Repair ran without error but the catalog is still short — this is
        // a logic/data problem, not a transient one, so don't spin on it.
        throw new Error(`${label} still incomplete after seeding`);
      } catch (error) {
        lastError = error;
        if (attempt < MAX_ATTEMPTS) {
          const delay = BASE_BACKOFF_MS * 2 ** (attempt - 1);
          this.logger.warn(
            { err: error },
            `Seed integrity: ${label} attempt ${attempt} failed — retrying in ${delay}ms`,
          );
          await sleep(delay);
        }
      }
    }
    throw new Error(
      `Seed integrity: ${label} could not be ensured after ${MAX_ATTEMPTS} attempts: ${
        lastError instanceof Error ? lastError.message : String(lastError)
      }`,
    );
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
