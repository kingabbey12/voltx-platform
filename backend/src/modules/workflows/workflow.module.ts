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
import { LoopStepExecutor } from './executors/loop-step-executor';
import { NotificationStepExecutor } from './executors/notification-step-executor';
import { StepExecutorRegistry } from './executors/step-executor.registry';
import { SwitchStepExecutor } from './executors/switch-step-executor';
import { ToolStepExecutor } from './executors/tool-step-executor';
import { WebhookStepExecutor } from './executors/webhook-step-executor';
import { WorkflowStatsService } from './observability/workflow-stats.service';
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
import { WorkflowTemplateController } from './workflow-template.controller';
import { WorkflowTemplateRepository } from './workflow-template.repository';
import { WorkflowTemplateService } from './workflow-template.service';
import { WorkflowSecretController } from './workflow-secret.controller';
import { WorkflowSecretRepository } from './workflow-secret.repository';
import { WorkflowSecretService } from './workflow-secret.service';
import { WorkflowVariableController } from './workflow-variable.controller';
import { WorkflowVariableRepository } from './workflow-variable.repository';
import { WorkflowVariableService } from './workflow-variable.service';
import { WorkflowWebhookController } from './workflow-webhook.controller';
import { WorkflowWebhookRepository } from './workflow-webhook.repository';
import { WorkflowWebhookService } from './workflow-webhook.service';

@Module({
  imports: [AIModule, AgentModule, AuthModule, ToolModule],
  // WorkflowTemplateController/WorkflowSecretController/WorkflowVariableController
  // MUST be registered before WorkflowController — their bare 'templates'/
  // 'secrets'/'variables' list routes are two path segments, exactly like
  // WorkflowController's GET ':id', so registration order decides which one
  // wins. WorkflowWebhookController has no such constraint (every one of
  // its routes is at least three segments) but lives here too for symmetry.
  controllers: [
    WorkflowTemplateController,
    WorkflowSecretController,
    WorkflowVariableController,
    WorkflowWebhookController,
    WorkflowController,
  ],
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
    WorkflowTemplateRepository,
    WorkflowSecretRepository,
    WorkflowVariableRepository,
    WorkflowWebhookRepository,
    WorkflowDefinitionValidatorService,
    AgentStepExecutor,
    ToolStepExecutor,
    ApiStepExecutor,
    WebhookStepExecutor,
    NotificationStepExecutor,
    ApprovalStepExecutor,
    DelayStepExecutor,
    LoopStepExecutor,
    SwitchStepExecutor,
    StepExecutorRegistry,
    WorkflowEngineService,
    WorkflowStatsService,
    WorkflowSchedulerService,
    WorkflowScheduleService,
    WorkflowService,
    WorkflowToolSourceService,
    WorkflowTemplateService,
    WorkflowSecretService,
    WorkflowVariableService,
    WorkflowWebhookService,
  ],
  exports: [WorkflowService, StepExecutorRegistry],
})
export class WorkflowModule {}
