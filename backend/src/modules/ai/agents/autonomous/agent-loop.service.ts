import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MessageResponseDto } from '../../conversations/dto/conversation.dto';
import { ConversationRepository } from '../../conversations/conversation.repository';
import { toAIMessage } from '../../conversations/to-ai-message';
import { AIGatewayService } from '../../gateway/ai-gateway.service';
import { AiGatewayStreamEvent } from '../../gateway/ai-gateway-stream-event.types';
import { MemoryService } from '../../memory/memory.service';
import { isAbortError } from '../../streaming/drain-generator';
import { ToolRegistry } from '../../tools/tool.registry';
import { ExecuteToolResponse } from '../../tools/tool.service';
import { ToolResult } from '../../tools/tool-result.types';
import { AgentFactory } from '../agent.factory';
import { AgentEntity } from '../entities/agent.entity';
import { AgentRunEntity } from '../entities/agent-run.entity';
import { AgentDecision } from './agent-decision.types';
import { AgentLoopInput, AgentLoopResult, AgentLoopStopReason } from './agent-loop.types';
import { AgentPlan } from './agent-plan.types';
import { AgentPlannerService } from './agent-planner.service';
import { AgentRepository } from '../agent.repository';
import { AgentRunStepRepository } from './agent-run-step.repository';
import { createTimeoutSignal } from './create-timeout-signal';
import { describeToolCatalog, renderToolCatalogForPrompt } from './describe-tool-catalog';
import { MultiAgentOrchestratorService } from './multi-agent-orchestrator.service';
import { MultiAgentStreamEvent } from './multi-agent-stream-event.types';
import { parseAgentDecision } from './parse-agent-decision';
import { ToolApprovalRequiredError } from '../../approvals/tool-approval-required.error';

type StreamableEvent = AiGatewayStreamEvent | MultiAgentStreamEvent;

const DEFAULT_MAX_ITERATIONS = 8;
const DEFAULT_MAX_TOOL_CALLS = 12;
const DEFAULT_TIMEOUT_MS = 120_000;

interface ScratchpadEntry {
  stepNumber: number;
  thought: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  observation?: string;
  isError?: boolean;
}

/**
 * Phase 1 autonomous execution loop: reason -> choose a tool (or finish) ->
 * execute -> observe -> repeat, until the model produces a final answer or
 * a safety limit is hit. Every reasoning and tool call goes through the
 * existing, unchanged AIGatewayService — this class owns only the
 * iteration control flow, decision parsing, and step persistence.
 */
@Injectable()
export class AgentLoopService {
  private readonly logger = new Logger(AgentLoopService.name);
  private readonly defaultMaxIterations: number;
  private readonly defaultMaxToolCalls: number;
  private readonly defaultTimeoutMs: number;

  constructor(
    private readonly aiGatewayService: AIGatewayService,
    private readonly agentPlannerService: AgentPlannerService,
    private readonly conversationRepository: ConversationRepository,
    private readonly memoryService: MemoryService,
    private readonly agentFactory: AgentFactory,
    private readonly toolRegistry: ToolRegistry,
    private readonly agentRunStepRepository: AgentRunStepRepository,
    private readonly agentRepository: AgentRepository,
    @Inject(forwardRef(() => MultiAgentOrchestratorService))
    private readonly multiAgentOrchestratorService: MultiAgentOrchestratorService,
    configService: ConfigService,
  ) {
    this.defaultMaxIterations = configService.get<number>(
      'ai.agentLoop.maxIterations',
      DEFAULT_MAX_ITERATIONS,
    );
    this.defaultMaxToolCalls = configService.get<number>(
      'ai.agentLoop.maxToolCalls',
      DEFAULT_MAX_TOOL_CALLS,
    );
    this.defaultTimeoutMs = configService.get<number>('ai.agentLoop.timeoutMs', DEFAULT_TIMEOUT_MS);
  }

  async *run(
    agent: AgentEntity,
    agentRun: AgentRunEntity,
    input: AgentLoopInput,
    grantedPermissions: string[],
    externalSignal?: AbortSignal,
  ): AsyncGenerator<StreamableEvent, AgentLoopResult> {
    const maxIterations = input.maxIterations ?? this.defaultMaxIterations;
    const maxToolCalls = input.maxToolCalls ?? this.defaultMaxToolCalls;
    const timeoutMs = input.timeoutMs ?? this.defaultTimeoutMs;
    const allowedToolNames = this.agentFactory.getAllowedToolNames(agent);
    const tools = describeToolCatalog(this.toolRegistry.list(), allowedToolNames);
    const availableAgents = input.coordinationState
      ? await this.describeAvailableAgents(agent)
      : [];

    const timeout = createTimeoutSignal(timeoutMs, externalSignal);
    const loopStartedAt = Date.now();

    try {
      const userMessage = await this.conversationRepository.createMessage({
        conversationId: agentRun.conversationId,
        role: 'USER',
        content: input.objective.trim(),
        metadata: {
          agentId: agent.id,
          agentName: agent.name,
          agentRunId: agentRun.id,
          mode: 'autonomous',
        },
      });

      const plan = await this.agentPlannerService.createPlan({
        agent,
        objective: input.objective,
        workspaceContext: input.workspaceContext,
        allowedToolNames,
        conversationId: agentRun.conversationId,
        agentRunId: agentRun.id,
        signal: timeout.signal,
      });

      yield { type: 'plan', objective: plan.objective, steps: plan.steps };
      await this.agentRunStepRepository.create({
        agentRunId: agentRun.id,
        stepNumber: 0,
        type: 'PLAN',
        summary: plan.steps.join(' -> '),
        output: { steps: plan.steps },
      });

      yield { type: 'status', status: 'streaming' };

      const history = await this.conversationRepository.findAllMessagesForConversation(
        agentRun.conversationId,
      );
      const conversationHistory = history.map(toAIMessage);

      const scratchpad: ScratchpadEntry[] = [];
      const toolMessages: MessageResponseDto[] = [];
      const toolResults: ToolResult[] = [];
      let toolCallCount = 0;
      let iteration = 0;
      let finalOutputText = '';
      let finalTokenUsage: Record<string, unknown> = {};
      let stoppedReason: AgentLoopStopReason | null = null;

      while (stoppedReason === null) {
        if (Date.now() - loopStartedAt >= timeoutMs) {
          stoppedReason = 'timeout';
          break;
        }

        if (iteration >= maxIterations) {
          stoppedReason = 'max_iterations';
          break;
        }

        iteration += 1;

        yield { type: 'step_started', stepNumber: iteration };
        await this.agentRepository.updateAgentRunProgress(agentRun.id, {
          currentStep: iteration,
          iterationCount: iteration,
          toolCallCount,
        });

        const systemPrompt = this.buildIterationSystemPrompt(
          agent,
          plan,
          tools,
          availableAgents,
          maxIterations,
          maxToolCalls,
        );
        const iterationWorkspaceContext = [
          ...(input.workspaceContext ?? []),
          ...this.renderScratchpad(scratchpad),
        ];
        const userPrompt =
          iteration === 1
            ? input.objective
            : 'Continue working toward the objective given the observations above. Decide your next action.';

        let decisionOutputText = '';

        for await (const event of this.aiGatewayService.streamChat({
          requestType: 'AGENT_RUN',
          agentId: agent.id,
          agentRunId: agentRun.id,
          conversationId: agentRun.conversationId,
          provider: agent.provider,
          model: agent.model,
          systemPrompt,
          workspaceContext: iterationWorkspaceContext,
          conversationHistory,
          userPrompt,
          temperature: input.temperature,
          maxOutputTokens: input.maxOutputTokens,
          signal: timeout.signal,
        })) {
          if (event.type === 'content_delta') {
            decisionOutputText += event.delta;
          } else if (event.type === 'message_end' && event.outputText) {
            decisionOutputText = event.outputText;
            finalTokenUsage = toUsageRecord(event.usage);
          }

          yield { type: 'provider_event', event };
        }

        const decision = parseAgentDecision(decisionOutputText);
        await this.agentRunStepRepository.create({
          agentRunId: agentRun.id,
          stepNumber: iteration,
          type: 'REASONING',
          summary: decision.thought || decisionOutputText.slice(0, 500),
        });

        yield {
          type: 'decision',
          stepNumber: iteration,
          decision: decision.kind === 'tool_call' ? 'continue_with_tool' : decision.kind,
          ...(decision.kind === 'tool_call' ? { toolName: decision.toolName } : {}),
        };

        if (decision.kind === 'final_answer') {
          finalOutputText = decision.content;
          stoppedReason = 'final_answer';
          break;
        }

        if (decision.kind === 'tool_call') {
          if (toolCallCount >= maxToolCalls) {
            stoppedReason = 'max_tool_calls';
            break;
          }

          const toolOutcome = await this.executeToolDecision(
            agent,
            agentRun,
            decision,
            allowedToolNames,
            grantedPermissions,
            timeout.signal,
            iteration,
          );

          toolCallCount += 1;
          scratchpad.push(toolOutcome.scratchpadEntry);

          if (toolOutcome.response) {
            toolMessages.push(toolOutcome.response.message);
            toolResults.push(toolOutcome.response.result);
          }

          for (const event of toolOutcome.events) {
            yield event;
          }

          for (const step of toolOutcome.steps) {
            await this.agentRunStepRepository.create({ agentRunId: agentRun.id, ...step });
          }

          if (toolOutcome.pendingApprovalId) {
            yield { type: 'status', status: 'completed' };
            await this.agentRunStepRepository.create({
              agentRunId: agentRun.id,
              stepNumber: iteration + 1,
              type: 'FINAL_ANSWER',
              summary: `Paused: waiting for approval of "${decision.toolName}" (approval id: ${toolOutcome.pendingApprovalId})`,
            });

            return {
              outputText: '',
              iterations: iteration,
              toolCallCount,
              stoppedReason: 'waiting_approval',
              tokenUsage: finalTokenUsage,
              userMessage: MessageResponseDto.fromEntity(userMessage),
              toolMessages,
              assistantMessage: null,
              toolResults,
              plan,
              pendingApprovalId: toolOutcome.pendingApprovalId,
            };
          }
        } else if (decision.kind === 'delegate') {
          if (!input.coordinationState) {
            scratchpad.push({
              stepNumber: iteration,
              thought: decision.thought,
              toolName: `delegate:${decision.agentName}`,
              observation: 'Delegation is not available in this context.',
              isError: true,
            });
          } else {
            const delegateGenerator = this.multiAgentOrchestratorService.delegate(
              agent,
              agentRun,
              { agentName: decision.agentName, objective: decision.objective },
              iteration,
              input.coordinationState,
              grantedPermissions,
              timeout.signal,
            );

            let delegateStep = await delegateGenerator.next();
            while (!delegateStep.done) {
              yield delegateStep.value;
              delegateStep = await delegateGenerator.next();
            }
            const outcome = delegateStep.value;

            scratchpad.push({
              stepNumber: iteration,
              thought: decision.thought,
              toolName: `delegate:${outcome.agentName}`,
              observation: outcome.resultText,
              isError: !outcome.succeeded,
            });
          }
        } else if (decision.kind === 'delegate_parallel') {
          if (!input.coordinationState) {
            scratchpad.push({
              stepNumber: iteration,
              thought: decision.thought,
              observation: 'Parallel delegation is not available in this context.',
              isError: true,
            });
          } else {
            const delegateGenerator = this.multiAgentOrchestratorService.delegateParallel(
              agent,
              agentRun,
              decision.delegations,
              iteration,
              input.coordinationState,
              grantedPermissions,
              timeout.signal,
            );

            let delegateStep = await delegateGenerator.next();
            while (!delegateStep.done) {
              yield delegateStep.value;
              delegateStep = await delegateGenerator.next();
            }

            for (const outcome of delegateStep.value) {
              scratchpad.push({
                stepNumber: iteration,
                thought: decision.thought,
                toolName: `delegate:${outcome.agentName}`,
                observation: outcome.resultText,
                isError: !outcome.succeeded,
              });
            }
          }
        }

        yield { type: 'next_step', stepNumber: iteration + 1 };
        await this.agentRepository.updateAgentRunProgress(agentRun.id, {
          currentStep: iteration,
          iterationCount: iteration,
          toolCallCount,
        });
      }

      if (stoppedReason !== 'final_answer') {
        this.logger.warn(
          { agentId: agent.id, agentRunId: agentRun.id, stoppedReason, iteration, toolCallCount },
          'Autonomous agent loop stopped before reaching a final answer; attempting recovery',
        );
        finalOutputText = await this.forceFinalAnswer(
          agent,
          agentRun,
          plan,
          scratchpad,
          conversationHistory,
          input,
          timeout,
        );
      }

      const trimmedFinalText = finalOutputText.trim();
      const assistantMessage = trimmedFinalText.length
        ? await this.conversationRepository.createMessage({
            conversationId: agentRun.conversationId,
            role: 'ASSISTANT',
            content: trimmedFinalText,
            metadata: {
              agentId: agent.id,
              agentName: agent.name,
              agentRunId: agentRun.id,
              mode: 'autonomous',
              stoppedReason,
            },
            tokenUsage: finalTokenUsage,
          })
        : null;

      await this.agentRunStepRepository.create({
        agentRunId: agentRun.id,
        stepNumber: iteration + 1,
        type: 'FINAL_ANSWER',
        summary: trimmedFinalText.slice(0, 500),
      });

      if (assistantMessage) {
        await this.memoryService.captureConversationMemories({
          conversationId: agentRun.conversationId,
          userContent: input.objective,
          assistantContent: assistantMessage.content,
          assistantMetadata: { agentId: agent.id, agentRunId: agentRun.id, mode: 'autonomous' },
        });
      }

      return {
        outputText: trimmedFinalText,
        iterations: iteration,
        toolCallCount,
        stoppedReason: stoppedReason ?? 'final_answer',
        tokenUsage: finalTokenUsage,
        userMessage: MessageResponseDto.fromEntity(userMessage),
        toolMessages,
        assistantMessage: assistantMessage ? MessageResponseDto.fromEntity(assistantMessage) : null,
        toolResults,
        plan,
      };
    } finally {
      timeout.clear();
    }
  }

  private async executeToolDecision(
    agent: AgentEntity,
    agentRun: AgentRunEntity,
    decision: Extract<AgentDecision, { kind: 'tool_call' }>,
    allowedToolNames: string[],
    grantedPermissions: string[],
    signal: AbortSignal,
    iteration: number,
  ): Promise<{
    response: ExecuteToolResponse | null;
    scratchpadEntry: ScratchpadEntry;
    events: AiGatewayStreamEvent[];
    steps: Array<{
      stepNumber: number;
      type: 'TOOL_CALL' | 'TOOL_RESULT' | 'TOOL_ERROR';
      summary: string;
      toolName?: string;
      input?: Record<string, unknown>;
      output?: Record<string, unknown>;
    }>;
    pendingApprovalId?: string;
  }> {
    const events: AiGatewayStreamEvent[] = [
      { type: 'tool_call_start', toolName: decision.toolName },
    ];

    if (allowedToolNames.length > 0 && !allowedToolNames.includes(decision.toolName)) {
      const message = `Tool "${decision.toolName}" is not allowed for agent "${agent.name}"`;
      events.push({ type: 'tool_call_error', toolName: decision.toolName, message });
      return {
        response: null,
        scratchpadEntry: {
          stepNumber: iteration,
          thought: decision.thought,
          toolName: decision.toolName,
          toolInput: decision.input,
          observation: message,
          isError: true,
        },
        events,
        steps: [
          {
            stepNumber: iteration,
            type: 'TOOL_ERROR',
            summary: message,
            toolName: decision.toolName,
            input: decision.input,
          },
        ],
      };
    }

    try {
      const response = await this.aiGatewayService.executeTool(
        {
          conversationId: agentRun.conversationId,
          toolName: decision.toolName,
          input: decision.input,
          signal,
        },
        { agentId: agent.id, agentRunId: agentRun.id, grantedPermissions },
      );

      events.push({
        type: 'tool_call_result',
        toolName: decision.toolName,
        durationMs: response.execution.durationMs ?? 0,
      });

      return {
        response,
        scratchpadEntry: {
          stepNumber: iteration,
          thought: decision.thought,
          toolName: decision.toolName,
          toolInput: decision.input,
          observation: response.result.content,
          isError: Boolean(response.result.isError),
        },
        events,
        steps: [
          {
            stepNumber: iteration,
            type: 'TOOL_CALL',
            summary: `Called ${decision.toolName}`,
            toolName: decision.toolName,
            input: decision.input,
          },
          {
            stepNumber: iteration,
            type: 'TOOL_RESULT',
            summary: response.result.content.slice(0, 500),
            toolName: decision.toolName,
            output: { content: response.result.content, isError: response.result.isError ?? false },
          },
        ],
      };
    } catch (error) {
      if (error instanceof ToolApprovalRequiredError) {
        events.push({
          type: 'run_paused_for_approval',
          approvalId: error.approvalId,
          toolName: decision.toolName,
        });

        return {
          response: null,
          scratchpadEntry: {
            stepNumber: iteration,
            thought: decision.thought,
            toolName: decision.toolName,
            toolInput: decision.input,
            observation: `Waiting for human approval before this action can run (approval id: ${error.approvalId}).`,
            isError: false,
          },
          events,
          steps: [
            {
              stepNumber: iteration,
              type: 'TOOL_CALL',
              summary: `Requested approval to call ${decision.toolName}`,
              toolName: decision.toolName,
              input: decision.input,
            },
          ],
          pendingApprovalId: error.approvalId,
        };
      }

      const message = error instanceof Error ? error.message : 'Tool execution failed';
      events.push({ type: 'tool_call_error', toolName: decision.toolName, message });

      return {
        response: null,
        scratchpadEntry: {
          stepNumber: iteration,
          thought: decision.thought,
          toolName: decision.toolName,
          toolInput: decision.input,
          observation: message,
          isError: true,
        },
        events,
        steps: [
          {
            stepNumber: iteration,
            type: 'TOOL_ERROR',
            summary: message,
            toolName: decision.toolName,
            input: decision.input,
          },
        ],
      };
    }
  }

  /**
   * Failure recovery: when a safety limit ends the loop before the model
   * produced a final_answer, make one bounded best-effort call asking for a
   * final answer given everything observed so far, instead of leaving the
   * run with nothing. If even this call fails (including because the
   * caller genuinely cancelled), fall back to a synthesized summary rather
   * than throwing — cancellation is the one case the caller itself detects
   * and reports, via isAbortError, so we still return normally here.
   */
  private async forceFinalAnswer(
    agent: AgentEntity,
    agentRun: AgentRunEntity,
    plan: AgentPlan,
    scratchpad: ScratchpadEntry[],
    conversationHistory: ReturnType<typeof toAIMessage>[],
    input: AgentLoopInput,
    timeout: ReturnType<typeof createTimeoutSignal>,
  ): Promise<string> {
    if (timeout.signal.aborted) {
      return this.summarizeIncompleteRun(plan, scratchpad);
    }

    const systemPrompt = [
      agent.description ? `Agent Role: ${agent.description}` : undefined,
      agent.systemPrompt,
      `You are executing autonomously toward this objective: "${plan.objective}"`,
      'You have run out of allowed steps. Do not request any more tools. Respond with your best possible final answer given the observations so far, as plain text (not JSON).',
    ]
      .filter(Boolean)
      .join('\n\n');

    let outputText = '';

    try {
      for await (const event of this.aiGatewayService.streamChat({
        requestType: 'AGENT_RUN',
        agentId: agent.id,
        agentRunId: agentRun.id,
        conversationId: agentRun.conversationId,
        provider: agent.provider,
        model: agent.model,
        systemPrompt,
        workspaceContext: [...(input.workspaceContext ?? []), ...this.renderScratchpad(scratchpad)],
        conversationHistory,
        userPrompt: 'Give your best final answer now.',
        temperature: input.temperature,
        maxOutputTokens: input.maxOutputTokens,
        signal: timeout.signal,
      })) {
        if (event.type === 'content_delta') {
          outputText += event.delta;
        } else if (event.type === 'message_end' && event.outputText) {
          outputText = event.outputText;
        }
      }
    } catch (error) {
      if (isAbortError(error)) {
        throw error;
      }
      this.logger.warn(
        { err: error, agentId: agent.id, agentRunId: agentRun.id },
        'Forced final-answer recovery call failed; synthesizing a summary instead',
      );
      return this.summarizeIncompleteRun(plan, scratchpad);
    }

    return outputText.trim().length > 0
      ? outputText
      : this.summarizeIncompleteRun(plan, scratchpad);
  }

  private summarizeIncompleteRun(plan: AgentPlan, scratchpad: ScratchpadEntry[]): string {
    const observations = scratchpad
      .filter((entry) => !entry.isError && entry.observation)
      .map((entry) => `- ${entry.toolName}: ${entry.observation?.slice(0, 200)}`);

    return [
      `I was unable to fully complete this objective ("${plan.objective}") within the allowed steps.`,
      observations.length > 0 ? `Here is what I found so far:\n${observations.join('\n')}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private buildIterationSystemPrompt(
    agent: AgentEntity,
    plan: AgentPlan,
    tools: ReturnType<typeof describeToolCatalog>,
    availableAgents: AgentEntity[],
    maxIterations: number,
    maxToolCalls: number,
  ): string {
    const actionInstructions = [
      'At each step, decide the single next action. Respond with ONLY a JSON object and nothing else — no prose, no markdown.',
      'To call a tool: {"thought": "<one short sentence>", "action": "tool_call", "toolName": "<tool name>", "input": {...}}',
      'To finish: {"thought": "<one short sentence>", "action": "final_answer", "content": "<your complete answer to the user>"}',
    ];

    if (availableAgents.length > 0) {
      actionInstructions.push(
        'To delegate one task to a specialized agent: {"thought": "...", "action": "delegate", "agentName": "<agent name>", "objective": "<specific objective for that agent>"}',
        'To delegate multiple independent tasks at once, so they run concurrently: {"thought": "...", "action": "delegate_parallel", "delegations": [{"agentName": "...", "objective": "..."}, ...]}',
      );
    }

    return [
      agent.description ? `Agent Role: ${agent.description}` : undefined,
      agent.systemPrompt,
      `You are executing autonomously toward this objective: "${plan.objective}"`,
      `Planned approach:\n${plan.steps.map((step, index) => `${index + 1}. ${step}`).join('\n')}`,
      `Available tools:\n${renderToolCatalogForPrompt(tools)}`,
      availableAgents.length > 0
        ? `You may delegate specialized work to these other agents:\n${renderAgentCatalogForPrompt(availableAgents)}`
        : undefined,
      actionInstructions.join('\n'),
      `You have at most ${maxIterations} reasoning steps and ${maxToolCalls} tool calls in this run — work efficiently and respond with final_answer as soon as you have enough information.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private async describeAvailableAgents(agent: AgentEntity): Promise<AgentEntity[]> {
    if (!this.agentFactory.canDelegate(agent)) {
      return [];
    }

    const allowedNames = this.agentFactory.getAllowedDelegateAgentNames(agent);
    const allAgents = await this.agentRepository.listAgents();
    const candidates = allAgents.filter(
      (candidate) => candidate.enabled && candidate.id !== agent.id,
    );

    return allowedNames.length > 0
      ? candidates.filter((candidate) => allowedNames.includes(candidate.name))
      : candidates;
  }

  private renderScratchpad(scratchpad: ScratchpadEntry[]): string[] {
    return scratchpad.map((entry, index) => {
      const label = entry.isError ? 'tool_error' : 'tool_result';
      return `Step ${index + 1} thought: ${entry.thought || '(none)'} -> called ${entry.toolName}(${JSON.stringify(entry.toolInput ?? {})}) -> ${label}: ${entry.observation ?? ''}`.slice(
        0,
        1000,
      );
    });
  }
}

function toUsageRecord(usage: unknown): Record<string, unknown> {
  return typeof usage === 'object' && usage !== null && !Array.isArray(usage)
    ? (usage as Record<string, unknown>)
    : {};
}

function renderAgentCatalogForPrompt(agents: AgentEntity[]): string {
  return agents.map((candidate) => `- ${candidate.name}: ${candidate.description}`).join('\n');
}
