import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { PERMISSION_DEFINITIONS, ROLE_DEFINITIONS, seedRbac } from './rbac.seed';
import { PLAN_SEEDS, seedBillingPlans } from './billing-plans.seed';
import { TEMPLATE_SEEDS, seedWorkflowTemplates } from './workflow-templates.seed';

/**
 * Boot-time seed-integrity guard. Production registration once failed with
 * Prisma P2025 because `register()` looks up the `owner` role and the
 * deploy pipeline's seed had not populated it against the production
 * database — a whole-platform auth outage caused by missing reference
 * data, not by any request-path bug.
 *
 * This service closes that gap for good: on every application bootstrap it
 * verifies the auth-critical baseline (RBAC roles/permissions, billing
 * plans) plus workflow templates, and idempotently repairs anything
 * missing using the exact same seeders the deploy pipeline runs. It is
 * belt-and-suspenders to deploy.yml's seed step, not a replacement — so a
 * skipped/failed deploy seed, a restored-but-unseeded database, or a
 * hand-rolled environment can never again take down registration.
 *
 * Repair is idempotent (upserts) and cheap in the common case (three
 * COUNT queries when everything is present). A repair failure is logged
 * loudly but never crashes boot: a running instance serving other traffic
 * is strictly better than a restart loop, and the next boot retries.
 */
@Injectable()
export class DatabaseSeedBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.configService.get<boolean>('database.seedOnBootstrap', true)) {
      return;
    }

    await this.ensureRbac();
    await this.ensureBillingPlans();
    await this.ensureWorkflowTemplates();
  }

  /** Roles + permissions — the `owner` role register() depends on. */
  private async ensureRbac(): Promise<void> {
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

  /** Billing plans/features — startTrialSubscription needs the `professional` plan. */
  private async ensureBillingPlans(): Promise<void> {
    await this.ensure(
      'billing plans',
      async () => (await this.prisma.system.plan.count()) >= PLAN_SEEDS.length,
      () => seedBillingPlans(this.prisma.system),
    );
  }

  /** Workflow templates — not auth-critical, repaired for completeness. */
  private async ensureWorkflowTemplates(): Promise<void> {
    await this.ensure(
      'workflow templates',
      async () =>
        (await this.prisma.system.workflowTemplate.count({ where: { isSystem: true } })) >=
        TEMPLATE_SEEDS.length,
      () => seedWorkflowTemplates(this.prisma.system),
    );
  }

  /**
   * Runs `check`; if it reports the data is already complete, returns
   * cheaply. Otherwise logs a warning, runs the idempotent `repair`, and
   * re-checks. Any error is logged at error level and swallowed so it
   * never crashes application boot.
   */
  private async ensure(
    label: string,
    check: () => Promise<boolean>,
    repair: () => Promise<void>,
  ): Promise<void> {
    try {
      if (await check()) {
        this.logger.debug(`Seed integrity OK: ${label} present`);
        return;
      }

      this.logger.warn(`Seed integrity: ${label} missing or incomplete — auto-repairing`);
      await repair();

      if (await check()) {
        this.logger.log(`Seed integrity: ${label} auto-repaired successfully`);
      } else {
        this.logger.error(
          `Seed integrity: ${label} still incomplete after auto-repair — manual intervention required`,
        );
      }
    } catch (error) {
      this.logger.error(
        { err: error },
        `Seed integrity: failed to verify/repair ${label}; continuing boot (will retry next restart)`,
      );
    }
  }
}
