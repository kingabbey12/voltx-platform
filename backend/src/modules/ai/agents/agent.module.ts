import { Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { MemoryModule } from '../memory/memory.module';
import { ToolModule } from '../tools/tool.module';
import { AgentController } from './agent.controller';
import { AgentExecutor } from './agent.executor';
import { AgentFactory } from './agent.factory';
import { AgentRegistry } from './agent.registry';
import { AgentRepository } from './agent.repository';
import { AgentService } from './agent.service';
import { AgentPlannerService } from './autonomous/agent-planner.service';
import { AgentLoopService } from './autonomous/agent-loop.service';
import { AgentMessageRepository } from './autonomous/agent-message.repository';
import { AgentRunStepRepository } from './autonomous/agent-run-step.repository';
import { MultiAgentOrchestratorService } from './autonomous/multi-agent-orchestrator.service';

@Module({
  imports: [AIModule, MemoryModule, ToolModule],
  controllers: [AgentController],
  providers: [
    AgentRepository,
    AgentFactory,
    AgentRegistry,
    AgentExecutor,
    AgentService,
    AgentPlannerService,
    AgentLoopService,
    AgentRunStepRepository,
    AgentMessageRepository,
    MultiAgentOrchestratorService,
  ],
  exports: [AgentService],
})
export class AgentModule {}
