import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import {
  cronTickKey,
  DISTRIBUTED_LOCK_SERVICE,
  DistributedLockService,
} from '../../common/scheduling/distributed-lock.service';
import { PrismaService } from '../../database/prisma.service';
import { DashboardMetricsService } from './dashboard-metrics.service';

/** Just after midnight UTC, so a day's row reflects that whole day. */
const NIGHTLY_SNAPSHOT_CRON = '5 0 * * *';
/** Only has to outlive inter-replica clock skew — the tick is in the key. */
const CRON_TICK_WINDOW_MS = 30 * 60_000;
/** Organizations per batch. Keeps one slow tenant from stalling the rest. */
const BATCH_SIZE = 50;

/**
 * Writes one metrics row per organization per day.
 *
 * Aggregate once, read many times: without this the dashboard would have to
 * scan operational tables on every load, and history would still be impossible
 * — yesterday's pipeline cannot be reconstructed from today's rows once an
 * opportunity is deleted or its amount edited.
 *
 * Runs under the distributed lock for the same reason the billing sweeps do:
 * with more than one replica, every instance fires the same tick. The upsert
 * makes a double-run harmless rather than duplicating rows, but the lock keeps
 * the work from being done N times.
 */
@Injectable()
export class DashboardAggregationService implements OnModuleInit {
  private readonly logger = new Logger(DashboardAggregationService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly prisma: PrismaService,
    private readonly metrics: DashboardMetricsService,
    @Inject(DISTRIBUTED_LOCK_SERVICE)
    private readonly distributedLock: DistributedLockService,
  ) {}

  onModuleInit(): void {
    this.registerJob('dashboard-daily-metrics', NIGHTLY_SNAPSHOT_CRON, async () => {
      await this.captureAllOrganizations();
    });
  }

  /**
   * Snapshots every organization. Public so it can be invoked directly for
   * backfill without waiting a day for the next tick.
   */
  async captureAllOrganizations(when = new Date()): Promise<{ captured: number; failed: number }> {
    let cursor: string | undefined;
    let captured = 0;
    let failed = 0;

    for (;;) {
      const organizations = await this.prisma.system.organization.findMany({
        select: { id: true },
        orderBy: { id: 'asc' },
        take: BATCH_SIZE,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });

      if (organizations.length === 0) break;

      for (const organization of organizations) {
        try {
          await this.metrics.captureDailySnapshot(organization.id, when);
          captured += 1;
        } catch (error: unknown) {
          // One tenant's failure must not abandon the rest — a single
          // organization with corrupt data would otherwise cost everyone
          // their history for that day.
          failed += 1;
          this.logger.error(
            { err: error, organizationId: organization.id },
            'Failed to capture daily dashboard metrics',
          );
        }
      }

      cursor = organizations[organizations.length - 1]?.id;
    }

    this.logger.log(`Daily dashboard metrics captured: ${captured} ok, ${failed} failed`);
    return { captured, failed };
  }

  private registerJob(name: string, cronExpression: string, fn: () => Promise<void>): void {
    if (this.schedulerRegistry.doesExist('cron', name)) {
      this.schedulerRegistry.deleteCronJob(name);
    }

    const job: CronJob = new CronJob(cronExpression, () => {
      void this.distributedLock
        .runOncePerWindow(cronTickKey(name, job.lastDate()), CRON_TICK_WINDOW_MS, fn)
        .catch((error: unknown) => {
          this.logger.error({ err: error, job: name }, 'Dashboard aggregation job failed');
        });
    });

    this.schedulerRegistry.addCronJob(name, job);
    job.start();
  }
}
