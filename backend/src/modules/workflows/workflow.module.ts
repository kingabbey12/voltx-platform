import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AIModule } from '../ai/ai.module';
import { AgentModule } from '../ai/agents/agent.module';
import { ToolModule } from '../ai/tools/tool.module';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
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
import { WorkflowAiService } from './ai/workflow-ai.service';
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
import { WORKFLOW_RUN_QUEUE } from './jobs/workflow-run-queue.constants';
import { WorkflowRunQueueService } from './jobs/workflow-run-queue.service';
import { WorkflowRunProcessor } from './jobs/workflow-run.processor';

// Same REDIS_ENABLED-gated pattern as agent.module.ts's AI-agent-task queue
// and attachments.module.ts's processing queue — when Redis isn't
// configured, WorkflowRunQueueService falls back to driving
// WorkflowEngineService.executeRun() inline instead of enqueuing (today's
// unchanged behavior; dev/test are unaffected since REDIS_ENABLED is unset
// there). BullModule.forRoot is @Global() and safe to call again here with
// the same connection config the other queue-owning modules already
// register it with.
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: WORKFLOW_RUN_QUEUE }),
    ]
  : [];
const queueProcessors = redisEnabled ? [WorkflowRunProcessor] : [];

@Module({
  imports: [AIModule, AgentModule, AuthModule, BillingModule, ToolModule, ...queueImports],
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
    WorkflowAiService,
    WorkflowTemplateService,
    WorkflowSecretService,
    WorkflowVariableService,
    WorkflowWebhookService,
    WorkflowRunQueueService,
    ...queueProcessors,
  ],
  exports: [WorkflowService, StepExecutorRegistry],
})
export class WorkflowModule {}
