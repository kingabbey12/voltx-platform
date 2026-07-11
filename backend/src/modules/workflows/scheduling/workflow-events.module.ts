import { Global, Module } from '@nestjs/common';
import { WorkflowEventBusService } from './workflow-event-bus.service';

/**
 * Standalone, @Global() home for WorkflowEventBusService — split out of
 * WorkflowModule so Sales/Communications/Integrations services can emit
 * domain events (contact.created, deal.updated, EMAIL_RECEIVED, ...)
 * without importing the whole WorkflowModule, avoiding any risk of a new
 * circular module dependency (mirrors NotificationModule's @Global()
 * treatment from v1.9.1, same rationale: a cross-cutting bus reachable
 * from many otherwise-unrelated modules).
 */
@Global()
@Module({
  providers: [WorkflowEventBusService],
  exports: [WorkflowEventBusService],
})
export class WorkflowEventsModule {}
