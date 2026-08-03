import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { MetricsModule } from '../../metrics/metrics.module';
import { ExecutiveContextModule } from '../context/context.module';
import { ExecutiveDecisionsModule } from '../decision/decision.module';
import { ExecutiveInsightsModule } from '../insights/insights.module';
import { OrchestratorController } from './orchestrator.controller';
import { OrchestratorEngine } from './orchestrator.engine';
import { OrchestratorMetrics } from './orchestrator.metrics';
import { OrchestratorCircuitBreaker, OrchestratorPolicy } from './orchestrator.policy';
import { OrchestratorRegistry } from './orchestrator.registry';
import { OrchestratorService } from './orchestrator.service';

@Module({
  imports: [
    ExecutiveContextModule,
    ExecutiveInsightsModule,
    ExecutiveDecisionsModule,
    AuditModule,
    MetricsModule,
  ],
  controllers: [OrchestratorController],
  providers: [
    OrchestratorRegistry,
    OrchestratorPolicy,
    OrchestratorCircuitBreaker,
    OrchestratorMetrics,
    OrchestratorEngine,
    OrchestratorService,
  ],
  exports: [OrchestratorService],
})
export class OrchestratorModule {}
