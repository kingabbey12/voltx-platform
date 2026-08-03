import { Module } from '@nestjs/common';
import { AgentModule } from '../agents/agent.module';
import { AIModule } from '../ai.module';
import { ExecutiveContextModule } from '../context/context.module';
import { ExecutiveDecisionsModule } from '../decision/decision.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { AutonomousWorkflowEngineModule } from '../workflow-engine/workflow-engine.module';
import { ExecutiveInsightsModule } from '../insights/insights.module';
import { BusinessIntelligenceModule } from '../../business-intelligence/business-intelligence.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';

@Module({
  imports: [
    AIModule,
    AgentModule,
    ExecutiveContextModule,
    ExecutiveInsightsModule,
    ExecutiveDecisionsModule,
    OrchestratorModule,
    AutonomousWorkflowEngineModule,
    BusinessIntelligenceModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
