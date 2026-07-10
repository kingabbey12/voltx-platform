import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../../../audit/audit.service';
import { AiGatewayStreamEvent } from '../../gateway/ai-gateway-stream-event.types';
import { AiUsageService } from '../../gateway/ai-usage.service';
import { mergeAsyncGenerators } from '../../streaming/merge-async-generators';
import { isAbortError } from '../../streaming/drain-generator';
import { AgentFactory } from '../agent.factory';
import { AgentRepository } from '../agent.repository';
import { AgentEntity } from '../entities/agent.entity';
import { AgentRunEntity } from '../entities/agent-run.entity';
import { DelegationTarget } from './agent-decision.types';
import { AgentLoopInput, AgentLoopResult } from './agent-loop.types';
import { AgentLoopService } from './agent-loop.service';
import { AgentMessageRepository } from './agent-message.repository';
import { AgentRunStepRepository } from './agent-run-step.repository';
import {
  assertCanSpawnAgent,
  CoordinationLimitExceededError,
  CoordinationLimits,
  CoordinationState,
  createCoordinationState,
  registerSpawnedAgent,
} from './coordination-state';
import { MultiAgentStreamEvent } from './multi-agent-stream-event.types';

type StreamableEvent = AiGatewayStreamEvent | MultiAgentStreamEvent;

export interface DelegationOutcome {
  agentName: string;
  succeeded: boolean;
  resultText: string;
}

const DEFAULT_MAX_AGENTS = 10;
const DEFAULT_MAX_DEPTH = 3;
const DEFAULT_MAX_PARALLEL = 4;
const DEFAULT_TIMEOUT_MS = 300_000;
const MAX_DELEGATION_RETRIES = 1;

/**
 * Coordinates a tree of agent runs: spawns/finalizes each agent's loop
 * execution (root or delegated child alike), and implements sequential and
 * parallel delegation by recursively invoking AgentLoopService — nested
 * delegation and the whole execution tree fall out of that recursion, not
 * a separate execution model. Every reasoning/tool call inside each node
 * still goes through the existing, unchanged AIGatewayService.
 */
@Injectable()
export class MultiAgentOrchestratorService {
  private readonly logger = new Logger(MultiAgentOrchestratorService.name);
  private readonly defaultMaxAgents: number;
  private readonly defaultMaxDepth: number;
  private readonly defaultMaxParallelExecutions: number;
  private readonly defaultTimeoutMs: number;

  constructor(
    @Inject(forwardRef(() => AgentLoopService))
    private readonly agentLoopService: AgentLoopService,
    private readonly agentRepository: AgentRepository,
    private readonly agentFactory: AgentFactory,
    private readonly agentMessageRepository: AgentMessageRepository,
    private readonly agentRunStepRepository: AgentRunStepRepository,
    private readonly auditService: AuditService,
    private readonly aiUsageService: AiUsageService,
    configService: ConfigService,
  ) {
    this.defaultMaxAgents = configService.get<number>(
      'ai.multiAgent.maxAgents',
      DEFAULT_MAX_AGENTS,
    );
    this.defaultMaxDepth = configService.get<number>('ai.multiAgent.maxDepth', DEFAULT_MAX_DEPTH);
    this.defaultMaxParallelExecutions = configService.get<number>(
      'ai.multiAgent.maxParallelExecutions',
      DEFAULT_MAX_PARALLEL,
    );
    this.defaultTimeoutMs = configService.get<number>(
      'ai.multiAgent.timeoutMs',
      DEFAULT_TIMEOUT_MS,
    );
  }

  createCoordinationStateForRoot(
    rootRunId: string,
    overrides: Partial<CoordinationLimits> = {},
  ): CoordinationState {
    return createCoordinationState(rootRunId, {
      maxAgents: overrides.maxAgents ?? this.defaultMaxAgents,
      maxDepth: overrides.maxDepth ?? this.defaultMaxDepth,
      maxParallelExecutions: overrides.maxParallelExecutions ?? this.defaultMaxParallelExecutions,
      timeoutMs: overrides.timeoutMs ?? this.defaultTimeoutMs,
    });
  }

  /**
   * Runs one agent's loop to completion and finalizes its AgentRun row to a
   * terminal status — the single place that does this for both the root
   * agent and every delegated child, so this bookkeeping exists exactly
   * once regardless of where in the tree a node sits.
   */
  async *runAgent(
    agent: AgentEntity,
    agentRun: AgentRunEntity,
    input: AgentLoopInput,
    coordinationState: CoordinationState,
    grantedPermissions: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamableEvent, AgentLoopResult> {
    const isRoot = agentRun.parentRunId === null;
    const startedAt = Date.now();

    if (isRoot) {
      yield {
        type: 'coordinator_started',
        rootRunId: coordinationState.rootRunId,
        objective: input.objective,
      };
    }
    yield { type: 'agent_working', agentRunId: agentRun.id, agentName: agent.name };

    const loopGenerator = this.agentLoopService.run(
      agent,
      agentRun,
      { ...input, coordinationState },
      grantedPermissions,
      signal,
    );

    try {
      let step = await loopGenerator.next();
      while (!step.done) {
        const event = step.value;
        yield isRoot
          ? event
          : {
              type: 'agent_event',
              agentRunId: agentRun.id,
              agentName: agent.name,
              parentRunId: agentRun.parentRunId,
              depth: agentRun.depth,
              event,
            };
        step = await loopGenerator.next();
      }
      const result = step.value;
      const usageSummary = await this.aiUsageService.summarizeForAgentRun(agentRun.id);
      const isWaitingApproval = result.stoppedReason === 'waiting_approval';

      await this.agentRepository.updateAgentRun(agentRun.id, {
        status: isWaitingApproval ? 'WAITING_APPROVAL' : 'SUCCEEDED',
        output: {
          outputText: result.outputText,
          iterations: result.iterations,
          toolCallCount: result.toolCallCount,
          stoppedReason: result.stoppedReason,
          plan: result.plan.steps,
          toolResults: result.toolResults.map((toolResult) => ({
            toolName: toolResult.toolName,
            content: toolResult.content,
            isError: toolResult.isError ?? false,
          })),
          ...(result.assistantMessage ? { assistantMessageId: result.assistantMessage.id } : {}),
          observability: {
            llmAndToolCallCount: usageSummary.callCount,
            totalTokens: usageSummary.totalTokens,
            totalCostUsd: usageSummary.totalCostUsd,
            totalDurationMs: usageSummary.totalDurationMs,
          },
        },
        currentStep: result.iterations,
        iterationCount: result.iterations,
        toolCallCount: result.toolCallCount,
        // A run waiting on approval is paused, not finished — leave
        // completedAt/durationMs unset until it's actually resumed to a
        // real terminal status.
        ...(isWaitingApproval
          ? {}
          : { completedAt: new Date(), durationMs: Date.now() - startedAt }),
        tokenUsage: result.tokenUsage,
        error: null,
      });

      await this.auditService.record({
        action: isRoot ? 'run_autonomous' : 'delegate_run',
        resource: 'ai_agent',
        resourceId: agent.id,
        metadata: {
          runId: agentRun.id,
          parentRunId: agentRun.parentRunId,
          conversationId: agentRun.conversationId,
          iterations: result.iterations,
          toolCallCount: result.toolCallCount,
          stoppedReason: result.stoppedReason,
        },
      });

      yield {
        type: 'agent_completed',
        agentRunId: agentRun.id,
        agentName: agent.name,
        succeeded: true,
      };
      if (isRoot) {
        yield {
          type: 'coordinator_finished',
          rootRunId: coordinationState.rootRunId,
          outputText: result.outputText,
        };
      }

      return result;
    } catch (error) {
      const cancelled = isAbortError(error);
      const status = cancelled ? 'TIMED_OUT' : 'FAILED';
      const errorMessage = error instanceof Error ? error.message : 'Agent execution failed';

      await this.agentRepository.updateAgentRun(agentRun.id, {
        status,
        output: {},
        completedAt: new Date(),
        durationMs: Date.now() - startedAt,
        tokenUsage: {},
        error: errorMessage,
      });

      await this.auditService.record({
        action: isRoot ? 'run_autonomous' : 'delegate_run',
        resource: 'ai_agent',
        resourceId: agent.id,
        metadata: {
          runId: agentRun.id,
          parentRunId: agentRun.parentRunId,
          status,
          error: errorMessage,
        },
      });

      yield {
        type: 'agent_completed',
        agentRunId: agentRun.id,
        agentName: agent.name,
        succeeded: false,
      };

      throw error;
    }
  }

  /**
   * Sequential single delegation. Resource-limit and lookup failures are
   * reported back as a failed outcome rather than thrown — the parent loop
   * treats a failed delegation exactly like a failed tool call (fed back
   * as an observation so the model can decide what to do next), never as a
   * crash. Only a genuine cancellation propagates.
   */
  async *delegate(
    parentAgent: AgentEntity,
    parentRun: AgentRunEntity,
    target: DelegationTarget,
    stepNumber: number,
    coordinationState: CoordinationState,
    grantedPermissions: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamableEvent, DelegationOutcome> {
    let attempt = 0;

    while (true) {
      const rejection = this.validateDelegation(parentAgent, parentRun, target, coordinationState);
      if (rejection) {
        return rejection;
      }

      const targetAgent = await this.agentRepository.findAgentByName(target.agentName);
      if (!targetAgent || !targetAgent.enabled) {
        return {
          agentName: target.agentName,
          succeeded: false,
          resultText: `Agent "${target.agentName}" was not found or is disabled.`,
        };
      }

      registerSpawnedAgent(coordinationState);

      const childRun = await this.agentRepository.createAgentRun({
        agentId: targetAgent.id,
        conversationId: parentRun.conversationId,
        parentRunId: parentRun.id,
        rootRunId: coordinationState.rootRunId,
        depth: parentRun.depth + 1,
        status: 'RUNNING',
        input: { mode: 'autonomous', objective: target.objective, delegatedBy: parentAgent.name },
        output: {},
        startedAt: new Date(),
        tokenUsage: {},
      });

      await this.agentMessageRepository.create({
        rootRunId: coordinationState.rootRunId,
        fromAgentRunId: parentRun.id,
        toAgentRunId: childRun.id,
        type: 'REQUEST',
        content: target.objective,
      });

      await this.agentRunStepRepository.create({
        agentRunId: parentRun.id,
        stepNumber,
        type: 'DELEGATION_START',
        summary: `Delegated to ${targetAgent.name}: ${target.objective}`,
        toolName: targetAgent.name,
        input: { objective: target.objective },
      });

      yield {
        type: 'agent_spawned',
        agentRunId: childRun.id,
        agentName: targetAgent.name,
        parentRunId: parentRun.id,
        depth: childRun.depth,
      };
      yield {
        type: 'delegation',
        fromAgentRunId: parentRun.id,
        toAgentName: targetAgent.name,
        objective: target.objective,
      };
      yield {
        type: 'agent_waiting',
        agentRunId: parentRun.id,
        agentName: parentAgent.name,
        waitingOnAgentRunId: childRun.id,
      };

      const childGenerator = this.runAgent(
        targetAgent,
        childRun,
        { objective: target.objective },
        coordinationState,
        grantedPermissions,
        signal,
      );

      let result: AgentLoopResult | null = null;
      let failure: unknown = null;

      try {
        let step = await childGenerator.next();
        while (!step.done) {
          yield step.value;
          step = await childGenerator.next();
        }
        result = step.value;
      } catch (error) {
        failure = error;
      }

      if (result) {
        await this.agentMessageRepository.create({
          rootRunId: coordinationState.rootRunId,
          fromAgentRunId: childRun.id,
          toAgentRunId: parentRun.id,
          type: 'COMPLETION',
          content: result.outputText,
        });

        await this.agentRunStepRepository.create({
          agentRunId: parentRun.id,
          stepNumber,
          type: 'DELEGATION_RESULT',
          summary: result.outputText.slice(0, 500),
          toolName: targetAgent.name,
          output: { outputText: result.outputText },
        });

        yield {
          type: 'aggregation',
          agentRunId: parentRun.id,
          childAgentRunIds: [childRun.id],
        };

        return { agentName: targetAgent.name, succeeded: true, resultText: result.outputText };
      }

      if (isAbortError(failure)) {
        throw failure;
      }

      const errorMessage = failure instanceof Error ? failure.message : 'Delegated agent failed';

      await this.agentMessageRepository.create({
        rootRunId: coordinationState.rootRunId,
        fromAgentRunId: childRun.id,
        toAgentRunId: parentRun.id,
        type: 'OBSERVATION',
        content: `Agent "${targetAgent.name}" failed: ${errorMessage}`,
      });

      if (attempt < MAX_DELEGATION_RETRIES) {
        attempt += 1;
        this.logger.warn(
          { agentName: target.agentName, attempt, error: errorMessage },
          'Delegated agent failed; retrying with a fresh run',
        );
        continue;
      }

      return {
        agentName: target.agentName,
        succeeded: false,
        resultText: `Agent "${target.agentName}" failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Concurrent fan-out for independent subtasks. Batches targets to the
   * configured max-parallel-executions and, within each batch, streams
   * every child's events live-interleaved (mergeAsyncGenerators) rather
   * than waiting for one to finish before showing another's progress. One
   * child failing never prevents the others in its batch from completing
   * (isolated per delegation, same as the sequential path).
   */
  async *delegateParallel(
    parentAgent: AgentEntity,
    parentRun: AgentRunEntity,
    targets: DelegationTarget[],
    stepNumber: number,
    coordinationState: CoordinationState,
    grantedPermissions: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<StreamableEvent, DelegationOutcome[]> {
    const outcomes: DelegationOutcome[] = [];
    const batchSize = Math.max(1, coordinationState.limits.maxParallelExecutions);

    for (let start = 0; start < targets.length; start += batchSize) {
      const batch = targets.slice(start, start + batchSize);
      const generators = batch.map((target) =>
        this.delegate(
          parentAgent,
          parentRun,
          target,
          stepNumber,
          coordinationState,
          grantedPermissions,
          signal,
        ),
      );

      const merged = mergeAsyncGenerators(generators);
      let step = await merged.next();
      while (!step.done) {
        yield step.value;
        step = await merged.next();
      }

      outcomes.push(...step.value);
    }

    return outcomes;
  }

  private validateDelegation(
    parentAgent: AgentEntity,
    parentRun: AgentRunEntity,
    target: DelegationTarget,
    coordinationState: CoordinationState,
  ): DelegationOutcome | null {
    try {
      assertCanSpawnAgent(coordinationState, parentRun.depth + 1);
    } catch (error) {
      if (error instanceof CoordinationLimitExceededError) {
        return { agentName: target.agentName, succeeded: false, resultText: error.message };
      }
      throw error;
    }

    if (!this.agentFactory.canDelegate(parentAgent)) {
      return {
        agentName: target.agentName,
        succeeded: false,
        resultText: `Agent "${parentAgent.name}" is not permitted to delegate.`,
      };
    }

    const allowedDelegateNames = this.agentFactory.getAllowedDelegateAgentNames(parentAgent);
    if (allowedDelegateNames.length > 0 && !allowedDelegateNames.includes(target.agentName)) {
      return {
        agentName: target.agentName,
        succeeded: false,
        resultText: `Delegation to "${target.agentName}" is not permitted for agent "${parentAgent.name}".`,
      };
    }

    return null;
  }
}
