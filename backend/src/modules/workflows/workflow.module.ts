import { Module } from '@nestjs/common';
import { AIModule } from '../ai/ai.module';
import { AgentModule } from '../ai/agents/agent.module';
import { ToolModule } from '../ai/tools/tool.module';
import { AuthModule } from '../auth/auth.module';
import { WorkflowDefinitionValidatorService } from './definition/workflow-definition-validator.service';
import { WorkflowEngineService } from './engine/workflow-engine.service';
import { AgentStepExecutor } from './executors/agent-step-executor';
import { ApiStepExecutor } from './executors/api-step-executor';
import { ApprovalStepExecutor } from './executors/approval-step-executor';
import { DelayStepExecutor } from './executors/delay-step-executor';
import { NotificationStepExecutor } from './executors/notification-step-executor';
import { StepExecutorRegistry } from './executors/step-executor.registry';
import { ToolStepExecutor } from './executors/tool-step-executor';
import { WebhookStepExecutor } from './executors/webhook-step-executor';
import { WorkflowStatsService } from './observability/workflow-stats.service';
import { WorkflowEventBusService } from './scheduling/workflow-event-bus.service';
import { WorkflowScheduleService } from './scheduling/workflow-schedule.service';
import { WorkflowSchedulerService } from './scheduling/workflow-scheduler.service';
import { WorkflowApprovalRepository } from './workflow-approval.repository';
import { WorkflowCheckpointRepository } from './workflow-checkpoint.repository';
import { WorkflowController } from './workflow.controller';
import { WorkflowDeadLetterRepository } from './workflow-dead-letter.repository';
import { WorkflowLogRepository } from './workflow-log.repository';
import { WorkflowRunRepository } from './workflow-run.repository';
import { WorkflowScheduleRepository } from './workflow-schedule.repository';
import { WorkflowRetryRepository } from './workflow-retry.repository';
import { WorkflowService } from './workflow.service';
import { WorkflowStepRunRepository } from './workflow-step-run.repository';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowVersionRepository } from './workflow-version.repository';
import { WorkflowToolSourceService } from './tools/workflow-tool-source.service';

@Module({
  imports: [AIModule, AgentModule, AuthModule, ToolModule],
  controllers: [WorkflowController],
  providers: [
    WorkflowRepository,
    WorkflowVersionRepository,
    WorkflowRunRepository,
    WorkflowStepRunRepository,
    WorkflowLogRepository,
    WorkflowCheckpointRepository,
    WorkflowRetryRepository,
    WorkflowDeadLetterRepository,
    WorkflowApprovalRepository,
    WorkflowScheduleRepository,
    WorkflowDefinitionValidatorService,
    AgentStepExecutor,
    ToolStepExecutor,
    ApiStepExecutor,
    WebhookStepExecutor,
    NotificationStepExecutor,
    ApprovalStepExecutor,
    DelayStepExecutor,
    StepExecutorRegistry,
    WorkflowEngineService,
    WorkflowStatsService,
    WorkflowEventBusService,
    WorkflowSchedulerService,
    WorkflowScheduleService,
    WorkflowService,
    WorkflowToolSourceService,
  ],
  exports: [WorkflowService, WorkflowEventBusService, StepExecutorRegistry],
})
export class WorkflowModule {}
