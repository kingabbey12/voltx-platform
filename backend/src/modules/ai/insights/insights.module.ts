import { Module } from '@nestjs/common';
import { AuditModule } from '../../audit/audit.module';
import { ExecutiveContextModule } from '../context/context.module';
import { ExecutiveInsightsController } from './insights.controller';
import { ExecutiveInsightsEngine } from './insights.engine';
import { ExecutiveInsightsService } from './insights.service';

@Module({
  imports: [ExecutiveContextModule, AuditModule],
  controllers: [ExecutiveInsightsController],
  providers: [ExecutiveInsightsEngine, ExecutiveInsightsService],
  exports: [ExecutiveInsightsService],
})
export class ExecutiveInsightsModule {}
