import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ExecutiveContextModule } from '../context/context.module';
import { ExecutiveInsightsModule } from '../insights/insights.module';
import { ExecutiveDecisionsController } from './decision.controller';
import { ExecutiveDecisionEngine } from './decision.engine';
import { ExecutiveDecisionsService } from './decision.service';

@Module({
  imports: [ExecutiveContextModule, ExecutiveInsightsModule, AuditModule],
  controllers: [ExecutiveDecisionsController],
  providers: [ExecutiveDecisionEngine, ExecutiveDecisionsService],
  exports: [ExecutiveDecisionsService],
})
export class ExecutiveDecisionsModule {}
