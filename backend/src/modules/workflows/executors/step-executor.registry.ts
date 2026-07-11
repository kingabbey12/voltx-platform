import { forwardRef, Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { WorkflowStepType } from '../definition/workflow-definition.types';
import { AgentStepExecutor } from './agent-step-executor';
import { ApiStepExecutor } from './api-step-executor';
import { ApprovalStepExecutor } from './approval-step-executor';
import { DelayStepExecutor } from './delay-step-executor';
import { LoopStepExecutor } from './loop-step-executor';
import { NotificationStepExecutor } from './notification-step-executor';
import { StepExecutor } from './step-executor.interface';
import { SwitchStepExecutor } from './switch-step-executor';
import { ToolStepExecutor } from './tool-step-executor';
import { WebhookStepExecutor } from './webhook-step-executor';

@Injectable()
export class StepExecutorRegistry {
  private readonly executorsByType: Map<WorkflowStepType, StepExecutor>;
  private readonly dynamicExecutorsByType = new Map<WorkflowStepType, StepExecutor>();

  constructor(
    agentStepExecutor: AgentStepExecutor,
    toolStepExecutor: ToolStepExecutor,
    apiStepExecutor: ApiStepExecutor,
    webhookStepExecutor: WebhookStepExecutor,
    notificationStepExecutor: NotificationStepExecutor,
    approvalStepExecutor: ApprovalStepExecutor,
    delayStepExecutor: DelayStepExecutor,
    @Inject(forwardRef(() => LoopStepExecutor))
    loopStepExecutor: LoopStepExecutor,
    switchStepExecutor: SwitchStepExecutor,
  ) {
    this.executorsByType = new Map<WorkflowStepType, StepExecutor>([
      [agentStepExecutor.type, agentStepExecutor],
      [toolStepExecutor.type, toolStepExecutor],
      [apiStepExecutor.type, apiStepExecutor],
      [webhookStepExecutor.type, webhookStepExecutor],
      [notificationStepExecutor.type, notificationStepExecutor],
      [approvalStepExecutor.type, approvalStepExecutor],
      [delayStepExecutor.type, delayStepExecutor],
      [loopStepExecutor.type, loopStepExecutor],
      [switchStepExecutor.type, switchStepExecutor],
    ]);
  }

  /**
   * Extension point for step types owned by other modules (e.g. the
   * integrations module's INTEGRATION step) — those modules depend on
   * WorkflowModule to reach this registry, never the other way around,
   * so no circular module dependency is introduced. Registered once from
   * an OnModuleInit provider in the owning module.
   */
  registerDynamicExecutor(type: WorkflowStepType, executor: StepExecutor): void {
    this.dynamicExecutorsByType.set(type, executor);
  }

  get(type: WorkflowStepType): StepExecutor {
    const executor = this.executorsByType.get(type) ?? this.dynamicExecutorsByType.get(type);
    if (!executor) {
      throw new InternalServerErrorException(`No step executor registered for type "${type}"`);
    }
    return executor;
  }
}
