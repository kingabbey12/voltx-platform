import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { SchedulerLockModule } from '../../common/scheduling/scheduler-lock.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardMetricsService } from './dashboard-metrics.service';
import { DashboardAggregationService } from './dashboard-aggregation.service';
import { AuditModule } from '../audit/audit.module';
import { SalesModule } from '../sales/sales.module';
import { DashboardRecommendationActionService } from './recommendations/dashboard-recommendation-action.service';
import { DashboardRecommendationProvider } from './recommendations/dashboard-recommendation.provider';
import { DashboardRecommendationRepository } from './recommendations/dashboard-recommendation.repository';
import { DashboardRecommendationService } from './recommendations/dashboard-recommendation.service';
import { DashboardRecommendationsController } from './recommendations/dashboard-recommendations.controller';
import {
  DASHBOARD_HEALTH_PROVIDER,
  DASHBOARD_INSIGHT_PROVIDER,
  DASHBOARD_PRIORITY_PROVIDER,
  NoopHealthProvider,
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
  imports: [DatabaseModule, SchedulerLockModule, SalesModule, AuditModule],
  controllers: [DashboardController, DashboardRecommendationsController],
  providers: [
    DashboardService,
    DashboardMetricsService,
    DashboardAggregationService,
    DashboardRecommendationRepository,
    DashboardRecommendationService,
    DashboardRecommendationActionService,
    DashboardRecommendationProvider,
    { provide: DASHBOARD_INSIGHT_PROVIDER, useExisting: DashboardRecommendationProvider },
    { provide: DASHBOARD_HEALTH_PROVIDER, useClass: NoopHealthProvider },
    { provide: DASHBOARD_PRIORITY_PROVIDER, useExisting: DashboardRecommendationProvider },
  ],
  exports: [DashboardMetricsService],
})
export class DashboardModule {}
