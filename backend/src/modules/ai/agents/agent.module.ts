import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIModule } from '../ai.module';
import { MemoryModule } from '../memory/memory.module';
import { PromptResolverModule } from '../prompts/prompt-resolver.module';
import { ToolModule } from '../tools/tool.module';
import { WorkflowEventsModule } from '../../workflows/scheduling/workflow-events.module';
import { AgentToolRepository } from './agent-tool.repository';
import { AgentVersionRepository } from './agent-version.repository';
import { AgentVersionService } from './agent-version.service';
import { AgentWorkflowLinkRepository } from './agent-workflow-link.repository';
import { AgentController } from './agent.controller';
import { AgentExecutor } from './agent.executor';
import { AgentFactory } from './agent.factory';
import { AgentRegistry } from './agent.registry';
import { AgentRepository } from './agent.repository';
import { AgentService } from './agent.service';
import { AgentApprovalController } from './approvals/agent-approval.controller';
import { AgentApprovalDecisionService } from './approvals/agent-approval-decision.service';
import { AgentRunResumeService } from './approvals/agent-run-resume.service';
import { AiDashboardController } from './dashboard/ai-dashboard.controller';
import { AiDashboardService } from './dashboard/ai-dashboard.service';
import { AiSuggestionRepository } from './dashboard/ai-suggestion.repository';
import { AiSuggestionService } from './dashboard/ai-suggestion.service';
import { AgentPlannerService } from './autonomous/agent-planner.service';
import { AgentLoopService } from './autonomous/agent-loop.service';
import { AgentMessageRepository } from './autonomous/agent-message.repository';
import { AgentRunStepRepository } from './autonomous/agent-run-step.repository';
import { MultiAgentOrchestratorService } from './autonomous/multi-agent-orchestrator.service';
import { AGENT_TASK_QUEUE } from './jobs/agent-task-queue.constants';
import { AgentTaskQueueService } from './jobs/agent-task-queue.service';
import { AgentTaskProcessor } from './jobs/agent-task.processor';
import { AgentScheduleRepository } from './scheduling/agent-schedule.repository';
import { AgentScheduleService } from './scheduling/agent-schedule.service';
import { AgentSchedulerRunService } from './scheduling/agent-scheduler-run.service';
import { AgentSchedulerService } from './scheduling/agent-scheduler.service';

// Same REDIS_ENABLED-gated pattern as communications.module.ts's AI
// process queue and attachments.module.ts's processing queue — when
// Redis isn't configured, AgentTaskQueueService falls back to running
// background tasks (currently: resuming a run after an approval decision)
// synchronously instead of enqueuing.
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: AGENT_TASK_QUEUE }),
    ]
  : [];
const queueProcessors = redisEnabled ? [AgentTaskProcessor] : [];

@Module({
  imports: [
    AIModule,
    MemoryModule,
    ToolModule,
    // Lightweight, acyclic read path for PromptsRepository — see
    // PromptResolverModule's own doc comment (AIModule already imports it
    // for the same reason; AgentModule needs PromptsRepository directly to
    // resolve an AgentVersion's linked Prompt key).
    PromptResolverModule,
    // @Global() — WorkflowEventBusService is already injectable anywhere,
    // this import is here only for clarity/explicitness, not strictly
    // required. Reusing the same bus Workflow scheduling uses means one
    // fired event can trigger both a workflow and an agent schedule.
    WorkflowEventsModule,
    ...queueImports,
  ],
  controllers: [AgentController, AgentApprovalController, AiDashboardController],
  providers: [
    AgentRepository,
    AgentFactory,
    AgentRegistry,
    AgentExecutor,
    AgentService,
    AgentVersionRepository,
    AgentToolRepository,
    AgentVersionService,
    AgentWorkflowLinkRepository,
    AgentScheduleRepository,
    AgentScheduleService,
    AgentSchedulerService,
    AgentSchedulerRunService,
    AgentPlannerService,
    AgentLoopService,
    AgentRunStepRepository,
    AgentMessageRepository,
    MultiAgentOrchestratorService,
    AgentApprovalDecisionService,
    AgentRunResumeService,
    AgentTaskQueueService,
    AiDashboardService,
    AiSuggestionRepository,
    AiSuggestionService,
    ...queueProcessors,
  ],
  exports: [AgentService, AgentWorkflowLinkRepository],
})
export class AgentModule {}
