import { Module } from '@nestjs/common';
import { AgentModule } from '../agents/agent.module';
import { SalesModule } from '../../sales/sales.module';
import { AttachmentsModule } from '../../attachments/attachments.module';
import { CommunicationsModule } from '../../communications/communications.module';
import { KnowledgeModule } from '../../knowledge/knowledge.module';
import { WorkflowModule } from '../../workflows/workflow.module';
import { AskController } from './ask.controller';
import { AskService } from './ask.service';
import { RecordResolverService } from './record-resolver.service';

/**
 * Ask — the interface between the human and the company (docs/design/
 * ASK.md). No second runtime: AskService wraps the existing autonomous agent
 * loop with the response contract and the grounding pipeline, and the record
 * resolver opens doors onto canonical records.
 */
@Module({
  imports: [
    AgentModule,
    SalesModule,
    AttachmentsModule,
    CommunicationsModule,
    KnowledgeModule,
    WorkflowModule,
  ],
  controllers: [AskController],
  providers: [AskService, RecordResolverService],
})
export class AskModule {}
