import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SchedulerLockModule } from '../../common/scheduling/scheduler-lock.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardAggregationService } from './dashboard-aggregation.service';

/**
 * The analytical layer, kept deliberately separate from the operational CRUD
 * modules.
 *
 *   Operational  Companies, Contacts, Leads, Opportunities, Workflows —
 *                transactional, one record at a time, optimised for writes.
 *   Analytical   this module — aggregates across many records, written once a
 *                day and read on every dashboard load.
 *
 * The separation is what allows forecasting, anomaly detection, benchmarking
 * and health scoring to be added later without coupling any of it to the
 * transactional APIs. It also means this module imports no sales services: it
 * reads the same tables through its own SQL aggregates, so a change to a CRUD
 * service's shape cannot silently alter what the dashboard reports.
 *
 * Still to build on this foundation:
 *  - DashboardInsightsService: reads the snapshot and produces the
 *    `insights[]` the contract already carries. Deliberately unpopulated for
 *    now rather than filled with invented warnings.
 *  - A health model with defensible weightings and thresholds, replacing the
 *    `unknown` status DashboardService currently returns.
 */
@Module({
  imports: [DatabaseModule, SchedulerLockModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardMetricsService, DashboardAggregationService],
  exports: [DashboardMetricsService],
})
export class DashboardModule {}
