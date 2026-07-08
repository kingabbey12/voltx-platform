import { Module } from '@nestjs/common';
import { AIModule } from '../ai.module';
import { AgentModule } from '../agents/agent.module';
import { OperatorController } from './operator.controller';
import { OperatorService } from './operator.service';

@Module({
  imports: [AIModule, AgentModule],
  controllers: [OperatorController],
  providers: [OperatorService],
})
export class OperatorModule {}
