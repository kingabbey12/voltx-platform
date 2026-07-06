import { Injectable } from '@nestjs/common';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { ToolStepDefinition } from '../definition/workflow-definition.types';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * Runs a TOOL step through AIGatewayService.executeTool unchanged — the
 * same call path an agent's own tool_call decision goes through, so tool
 * permission checks, rate limiting, and usage/audit telemetry all apply
 * identically whether a tool was invoked by an agent's own reasoning or a
 * workflow step.
 */
@Injectable()
export class ToolStepExecutor implements StepExecutor {
  readonly type = 'TOOL' as const;

  constructor(private readonly aiGatewayService: AIGatewayService) {}

  async execute(
    step: ToolStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const response = await this.aiGatewayService.executeTool(
      {
        conversationId: context.conversationId,
        toolName: step.config.toolName,
        input: step.config.input,
        signal: context.signal,
      },
      { grantedPermissions: context.grantedPermissions },
    );

    if (response.result.isError) {
      throw new Error(response.result.content);
    }

    return { output: { content: response.result.content } };
  }
}
