import { BadRequestException, Injectable } from '@nestjs/common';
import { AgentService } from '../../ai/agents/agent.service';
import { drainToReturnValue } from '../../ai/streaming/drain-generator';
import { AgentStepDefinition } from '../definition/workflow-definition.types';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * Runs an AGENT step by calling into AgentService.runAutonomousAgentStream
 * unchanged — the exact entry point used by the /run/autonomous(/stream)
 * endpoints. This is what gives every AGENT step, for free and without
 * any workflow-specific code: the full VT-021/022 stack (plan -> reason ->
 * tool -> observe loop, multi-agent delegation if the agent chooses to
 * delegate) and automatic knowledge/memory/CRM context injection via the
 * AI Gateway (VT-023) — the workflow engine never talks to the model or
 * the knowledge/memory subsystems directly.
 *
 * "Previous Outputs" (the ticket's Knowledge Integration requirement) is
 * satisfied the same way: earlier steps' outputs, already accumulated in
 * WorkflowRun.context, are rendered into extra workspaceContext strings
 * alongside whatever the step author supplied — no separate retrieval
 * path, just more entries in the same array the Gateway already merges
 * with knowledge/memory context.
 */
@Injectable()
export class AgentStepExecutor implements StepExecutor {
  readonly type = 'AGENT' as const;

  constructor(private readonly agentService: AgentService) {}

  async execute(
    step: AgentStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const agent = await this.agentService.findAgentByName(step.config.agentName);
    if (!agent || !agent.enabled) {
      throw new BadRequestException(
        `Agent "${step.config.agentName}" was not found or is disabled`,
      );
    }

    const workspaceContext = [
      ...(step.config.workspaceContext ?? []),
      ...renderPreviousOutputs(context.runContext),
    ];

    const result = await drainToReturnValue(
      this.agentService.runAutonomousAgentStream(
        agent.id,
        {
          conversationId: context.conversationId,
          objective: step.config.objective,
          workspaceContext,
          maxIterations: step.config.maxIterations,
          maxToolCalls: step.config.maxToolCalls,
        },
        context.grantedPermissions,
        context.signal,
      ),
    );

    return {
      output: {
        runId: result.run.id,
        status: result.run.status,
        outputText: result.assistantMessage?.content ?? '',
        agentOutput: result.run.output,
      },
    };
  }
}

function renderPreviousOutputs(runContext: Record<string, unknown>): string[] {
  return Object.entries(runContext).map(
    ([stepId, output]) => `Previous step "${stepId}" output: ${JSON.stringify(output)}`,
  );
}
