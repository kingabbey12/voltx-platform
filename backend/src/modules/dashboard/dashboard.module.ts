import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SchedulerLockModule } from '../../common/scheduling/scheduler-lock.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardAggregationService } from './dashboard-aggregation.service';
import {
  DASHBOARD_HEALTH_PROVIDER,
  DASHBOARD_INSIGHT_PROVIDER,
  DASHBOARD_PRIORITY_PROVIDER,
  NoopHealthProvider,
  NoopInsightProvider,
  NoopPriorityProvider,
} from './dashboard-providers.interface';

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
 * Intelligence enters through three injected providers rather than being
 * embedded in DashboardService. Today they are bound to no-op implementations
 * that return nothing — which is honest — so replacing them with real insight,
 * health and priority engines is a change to these bindings alone. The service,
 * the controller, the response contract and the UI all stay as they are.
 */
@Module({
  imports: [DatabaseModule, SchedulerLockModule],
  controllers: [DashboardController],
  providers: [
    DashboardService,
    DashboardMetricsService,
    DashboardAggregationService,
    { provide: DASHBOARD_INSIGHT_PROVIDER, useClass: NoopInsightProvider },
    { provide: DASHBOARD_HEALTH_PROVIDER, useClass: NoopHealthProvider },
    { provide: DASHBOARD_PRIORITY_PROVIDER, useClass: NoopPriorityProvider },
  ],
  exports: [DashboardMetricsService],
})
export class DashboardModule {}
