import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { WorkflowModule } from '../../workflows/workflow.module';
import { AIModule } from '../ai.module';
import { ExecutiveContextModule } from '../context/context.module';
import { ExecutiveDecisionsModule } from '../decision/decision.module';
import { ExecutiveInsightsModule } from '../insights/insights.module';
import { WorkflowPlanApprovalService } from './workflow-engine.approval';
import { AutonomousWorkflowPlansController } from './workflow-engine.controller';
import { AutonomousWorkflowEngine } from './workflow-engine.engine';
import { WorkflowPlanExecutionHandoff } from './workflow-engine.handoff';
import { AutonomousWorkflowPlanMetrics } from './workflow-engine.metrics';
import { WorkflowPlanRepository } from './workflow-engine.repository';
import { AutonomousWorkflowPlansService } from './workflow-engine.service';

@Module({
  imports: [
    ExecutiveContextModule,
    ExecutiveInsightsModule,
    ExecutiveDecisionsModule,
    AuditModule,
    MetricsModule,
    // The approval framework this module reuses rather than replaces.
    AIModule,
    // The workflow module that owns execution after handoff.
    WorkflowModule,
  ],
  controllers: [AutonomousWorkflowPlansController],
  providers: [
    AutonomousWorkflowEngine,
    AutonomousWorkflowPlansService,
    AutonomousWorkflowPlanMetrics,
    WorkflowPlanRepository,
    WorkflowPlanApprovalService,
    WorkflowPlanExecutionHandoff,
  ],
  exports: [
    AutonomousWorkflowPlansService,
    WorkflowPlanApprovalService,
    WorkflowPlanExecutionHandoff,
  ],
})
export class AutonomousWorkflowEngineModule {}
