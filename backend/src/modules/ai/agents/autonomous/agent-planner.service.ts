import { Injectable, Logger } from '@nestjs/common';
import { AIGatewayService } from '../../gateway/ai-gateway.service';
import { ToolRegistry } from '../../tools/tool.registry';
import { AgentEntity } from '../entities/agent.entity';
import { describeToolCatalog, renderToolCatalogForPrompt } from './describe-tool-catalog';
import { extractJsonObject } from './extract-json-object';
import { AgentPlan } from './agent-plan.types';

const MAX_PLAN_STEPS = 6;
const DEFAULT_PLAN_STEPS = ['Work directly toward the objective using the available tools.'];

export interface CreatePlanInput {
  agent: AgentEntity;
  objective: string;
  workspaceContext?: string[];
  allowedToolNames: string[];
  conversationId: string;
  agentRunId: string;
  signal?: AbortSignal;
}

/**
 * Converts a user objective into a short list of anticipated steps before
 * autonomous execution begins. The plan is advisory context fed into every
 * loop iteration's reasoning prompt, not a rigid script — the loop still
 * re-reasons each iteration since real tool results routinely diverge from
 * any plan drawn up in advance. Planning failures degrade to a one-step
 * plan rather than aborting the run: planning is a guidance aid, not a
 * hard dependency of execution.
 */
@Injectable()
export class AgentPlannerService {
  private readonly logger = new Logger(AgentPlannerService.name);

  constructor(
    private readonly aiGatewayService: AIGatewayService,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  async createPlan(input: CreatePlanInput): Promise<AgentPlan> {
    const tools = describeToolCatalog(this.toolRegistry.list(), input.allowedToolNames);

    const systemPrompt = [
      `You are the planning module for the "${input.agent.name}" agent.`,
      `Break the user's objective into a short list of concrete steps needed to achieve it, using only the tools actually available below where relevant.`,
      `Available tools:\n${renderToolCatalogForPrompt(tools)}`,
      `Respond with ONLY a JSON object of the exact shape {"steps": ["first step", "second step"]} and nothing else — no prose, no markdown. Use at most ${MAX_PLAN_STEPS} steps.`,
    ].join('\n\n');

    let outputText = '';

    try {
      for await (const event of this.aiGatewayService.streamChat({
        requestType: 'AGENT_RUN',
        agentId: input.agent.id,
        agentRunId: input.agentRunId,
        conversationId: input.conversationId,
        provider: input.agent.provider,
        model: input.agent.model,
        systemPrompt,
        workspaceContext: input.workspaceContext,
        userPrompt: input.objective,
        temperature: 0.2,
        maxOutputTokens: 500,
        signal: input.signal,
      })) {
        if (event.type === 'content_delta') {
          outputText += event.delta;
        } else if (event.type === 'message_end' && event.outputText) {
          outputText = event.outputText;
        }
      }
    } catch (error) {
      this.logger.warn(
        { err: error, agentId: input.agent.id, agentRunId: input.agentRunId },
        'Agent planning call failed; falling back to a single-step plan',
      );
      return { objective: input.objective, steps: DEFAULT_PLAN_STEPS };
    }

    const steps = this.parseSteps(outputText);
    return {
      objective: input.objective,
      steps: steps.length > 0 ? steps.slice(0, MAX_PLAN_STEPS) : DEFAULT_PLAN_STEPS,
    };
  }

  private parseSteps(text: string): string[] {
    const parsed = extractJsonObject(text);
    const steps = parsed?.steps;

    if (!Array.isArray(steps)) {
      return [];
    }

    return steps.filter(
      (step): step is string => typeof step === 'string' && step.trim().length > 0,
    );
  }
}
