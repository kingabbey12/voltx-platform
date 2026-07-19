import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SystemSeedService } from './system-seed.service';

/**
 * Boot-time seed-integrity guard. Production registration once failed with
 * Prisma P2025 because `register()` looks up the `owner` role and the
 * production database had no RBAC rows — a whole-platform auth outage
 * caused by missing reference data, not a request-path bug.
 *
 * On every boot this verifies and idempotently repairs the auth-critical
 * baseline (RBAC roles/permissions, billing plans) plus workflow templates
 * via SystemSeedService (which retries with backoff to survive a cold
 * Neon database). Repairs here are best-effort and never crash boot: a
 * running instance is better than a restart loop, and AuthService.register
 * re-checks lazily at request time as the definitive safety net, so a
 * boot-time failure can no longer keep registration broken.
 */
@Injectable()
export class DatabaseSeedBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSeedBootstrapService.name);
  private bootstrapPromise: Promise<void> | null = null;

  constructor(
    private readonly systemSeedService: SystemSeedService,
    private readonly configService: ConfigService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureSeedIntegrityOnBootstrap();
  }

  async ensureSeedIntegrityOnBootstrap(): Promise<void> {
    if (!this.bootstrapPromise) {
      this.bootstrapPromise = this.runBootstrapSeedIntegrity();
    }

    await this.bootstrapPromise;
  }

  private async runBootstrapSeedIntegrity(): Promise<void> {
    if (!this.configService.get<boolean>('database.seedOnBootstrap', true)) {
      this.logger.log(
        'Boot seed bootstrap disabled by configuration (database.seedOnBootstrap=false)',
      );
      return;
    }

    this.logger.log('Boot seed bootstrap started');

    this.warnIfPooledWithoutPgbouncerFlag();

    // Each is independent — one failing must not skip the others. Failures
    // are non-fatal here (register's lazy self-heal covers the gap).
    await this.attempt('RBAC', async () => {
      this.logger.log('Boot seed bootstrap ensuring RBAC');
      await this.systemSeedService.ensureRbac();
      this.logger.log('Boot seed bootstrap RBAC ensured');
    });
    await this.attempt('billing plans', () => this.systemSeedService.ensureBillingPlans());
    await this.attempt('workflow templates', () =>
      this.systemSeedService.ensureWorkflowTemplates(),
    );

    this.logger.log('Boot seed bootstrap finished');
  }

  private async attempt(label: string, run: () => Promise<void>): Promise<void> {
    try {
      await run();
    } catch (error) {
      this.logger.error(
        { err: error },
        `Boot seed of ${label} failed; continuing (register() will self-heal on first use, next restart retries)`,
      );
    }
  }

  /**
   * A Neon (or any PgBouncer transaction-mode) pooled connection string
   * needs `?pgbouncer=true` or Prisma's prepared statements collide across
   * pooled sessions — which surfaces as intermittent seed/query failures
   * that look exactly like "the seed didn't run". Detect and warn loudly
   * rather than let it be a silent, hard-to-diagnose outage.
   */
  private warnIfPooledWithoutPgbouncerFlag(): void {
    const url = process.env.DATABASE_URL ?? '';
    const looksPooled = /-pooler\.|pgbouncer|\bpooler\b/i.test(url);
    const hasFlag = /[?&]pgbouncer=true/i.test(url);
    if (looksPooled && !hasFlag) {
      this.logger.warn(
        'DATABASE_URL looks like a pooled/PgBouncer endpoint but is missing "?pgbouncer=true". ' +
          'Add it (Prisma requires it for transaction-mode poolers such as Neon) to avoid ' +
          'intermittent "prepared statement already exists" errors during seeding and queries.',
      );
    }
  }
}
