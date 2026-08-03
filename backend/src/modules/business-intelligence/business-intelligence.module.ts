import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { ExecutiveContextModule } from '../ai/context/context.module';
import { BusinessIntelligenceController } from './business-intelligence.controller';
import { BusinessIntelligenceEngine } from './business-intelligence.engine';
import { BusinessIntelligenceService } from './business-intelligence.service';
@Module({
  imports: [ExecutiveContextModule, AuditModule],
  controllers: [BusinessIntelligenceController],
  providers: [BusinessIntelligenceEngine, BusinessIntelligenceService],
  exports: [BusinessIntelligenceService],
})
export class BusinessIntelligenceModule {}
