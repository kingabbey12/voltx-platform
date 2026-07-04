import { Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { MemoryModule } from '../memory/memory.module';
import { AgentController } from './agent.controller';
import { AgentExecutor } from './agent.executor';
import { AgentFactory } from './agent.factory';
import { AgentRegistry } from './agent.registry';
import { AgentRepository } from './agent.repository';
import { AgentService } from './agent.service';

@Module({
  imports: [AIModule, MemoryModule],
  controllers: [AgentController],
  providers: [AgentRepository, AgentFactory, AgentRegistry, AgentExecutor, AgentService],
  exports: [AgentService],
})
export class AgentModule {}
