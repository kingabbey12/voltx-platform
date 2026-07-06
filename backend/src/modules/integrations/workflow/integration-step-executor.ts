import { Injectable } from '@nestjs/common';
import {
  StepExecutionContext,
  StepExecutionResult,
  StepExecutor,
} from '../../workflows/executors/step-executor.interface';
import { WorkflowStepDefinition } from '../../workflows/definition/workflow-definition.types';
import { IntegrationDispatcherService } from '../dispatch/integration-dispatcher.service';
import { IntegrationProviderKey } from '../provider/integration-provider.types';

/**
 * Makes every connector action usable as a workflow step (VT-024 reuse) —
 * a thin wrapper around IntegrationDispatcherService.execute, exactly
 * like ToolStepExecutor wraps AIGatewayService.executeTool. The workflow
 * engine itself never talks to a connector directly.
 */
@Injectable()
export class IntegrationStepExecutor implements StepExecutor {
  readonly type = 'INTEGRATION' as const;

  constructor(private readonly integrationDispatcherService: IntegrationDispatcherService) {}

  async execute(
    step: WorkflowStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (step.type !== 'INTEGRATION') {
      throw new Error(`IntegrationStepExecutor received a non-INTEGRATION step "${step.id}"`);
    }

    const output = await this.integrationDispatcherService.execute({
      provider: step.config.provider as IntegrationProviderKey,
      actionName: step.config.actionName,
      input: step.config.input,
      connectionId: step.config.connectionId,
      signal: context.signal,
    });

    return { output: output as Record<string, unknown> };
  }
}
