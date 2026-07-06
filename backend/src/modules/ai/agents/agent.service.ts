import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { AuditService } from '../../audit/audit.service';
import { AiGatewayStreamEvent } from '../gateway/ai-gateway-stream-event.types';
import { ModelRegistryService } from '../models/model-registry.service';
import { drainToReturnValue, isAbortError } from '../streaming/drain-generator';
import { AgentExecutor } from './agent.executor';
import { AgentFactory } from './agent.factory';
import { MultiAgentOrchestratorService } from './autonomous/multi-agent-orchestrator.service';
import { MultiAgentStreamEvent } from './autonomous/multi-agent-stream-event.types';
import { AgentRegistry } from './agent.registry';
import { AgentRepository } from './agent.repository';
import { RunAutonomousAgentDto } from './dto/autonomous-agent.dto';
import {
  AgentResponseDto,
  AgentRunResponseDto,
  CreateAgentDto,
  RunAgentDto,
  RunAgentResponseDto,
  UpdateAgentDto,
} from './dto/agent.dto';
import { AgentEntity } from './entities/agent.entity';

@Injectable()
export class AgentService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly agentRegistry: AgentRegistry,
    private readonly agentExecutor: AgentExecutor,
    private readonly multiAgentOrchestratorService: MultiAgentOrchestratorService,
    private readonly agentFactory: AgentFactory,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly auditService: AuditService,
  ) {}

  async listAgents(): Promise<AgentResponseDto[]> {
    await this.agentRegistry.ensureSystemAgents();
    const agents = await this.agentRepository.listAgents();
    return agents.map((agent) => AgentResponseDto.fromEntity(agent));
  }

  async findAgentByName(name: string): Promise<AgentEntity | null> {
    await this.agentRegistry.ensureSystemAgents();
    return this.agentRepository.findAgentByName(name);
  }

  async createAgent(dto: CreateAgentDto): Promise<AgentResponseDto> {
    await this.assertUniqueName(dto.name);
    const { provider, model } = await this.modelRegistryService.resolveProviderAndModel(
      dto.provider,
      dto.model,
      'chat',
    );

    const agent = await this.agentRepository.createAgent({
      name: dto.name.trim(),
      description: dto.description.trim(),
      systemPrompt: dto.systemPrompt.trim(),
      provider: provider.name,
      model: model.id,
      configuration: normalizeConfiguration(dto.configuration, 'custom'),
      enabled: dto.enabled ?? true,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'ai_agent',
      resourceId: agent.id,
      metadata: {
        provider: agent.provider,
        model: agent.model,
        enabled: agent.enabled,
      },
    });

    return AgentResponseDto.fromEntity(agent);
  }

  async updateAgent(id: string, dto: UpdateAgentDto): Promise<AgentResponseDto> {
    const existing = await this.getAgentOrThrow(id);
    if (dto.name) {
      await this.assertUniqueName(dto.name, existing.id);
    }

    const requestedProvider = dto.provider ?? existing.provider;
    const requestedModel = dto.model ?? existing.model;
    const resolved =
      dto.provider !== undefined || dto.model !== undefined
        ? await this.modelRegistryService.resolveProviderAndModel(
            requestedProvider,
            requestedModel,
            'chat',
          )
        : null;

    const updated = await this.agentRepository.updateAgent(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.systemPrompt !== undefined ? { systemPrompt: dto.systemPrompt.trim() } : {}),
      ...(resolved ? { provider: resolved.provider.name, model: resolved.model.id } : {}),
      ...(dto.configuration !== undefined
        ? {
            configuration: normalizeConfiguration(
              dto.configuration,
              getConfigurationKind(existing),
            ),
          }
        : {}),
      ...(dto.enabled !== undefined ? { enabled: dto.enabled } : {}),
    });

    if (!updated) {
      throw new NotFoundException(`Agent with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'ai_agent',
      resourceId: updated.id,
      metadata: dto as Record<string, unknown>,
    });

    return AgentResponseDto.fromEntity(updated);
  }

  async deleteAgent(id: string): Promise<AgentResponseDto> {
    const deleted = await this.agentRepository.softDeleteAgent(id);
    if (!deleted) {
      throw new NotFoundException(`Agent with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'ai_agent',
      resourceId: deleted.id,
      metadata: {
        name: deleted.name,
      },
    });

    return AgentResponseDto.fromEntity(deleted);
  }

  async runAgent(
    id: string,
    dto: RunAgentDto,
    grantedPermissions: string[] = [],
  ): Promise<RunAgentResponseDto> {
    return drainToReturnValue(this.runAgentStream(id, dto, grantedPermissions));
  }

  /**
   * Same agent-run lifecycle as runAgent (create the AgentRun row, execute
   * the turn, update the run to SUCCEEDED/FAILED/TIMED_OUT, audit-log the
   * outcome), expressed as a generator so runAgent can drain it for its
   * existing JSON response and the new streaming endpoint can re-yield it
   * live — one implementation of the run lifecycle, two consumption modes.
   */
  async *runAgentStream(
    id: string,
    dto: RunAgentDto,
    grantedPermissions: string[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<AiGatewayStreamEvent, RunAgentResponseDto> {
    yield { type: 'status', status: 'queued' };

    await this.agentRegistry.ensureSystemAgents();
    const agent = await this.getAgentOrThrow(id);
    if (!agent.enabled) {
      throw new BadRequestException(`Agent "${agent.name}" is disabled`);
    }

    yield { type: 'status', status: 'processing' };

    const startedAt = new Date();
    const run = await this.agentRepository.createAgentRun({
      agentId: agent.id,
      conversationId: dto.conversationId,
      status: 'RUNNING',
      input: {
        prompt: dto.prompt,
        workspaceContext: dto.workspaceContext ?? [],
        toolRequests: (dto.toolRequests ?? []).map((item) => ({
          toolName: item.toolName,
          input: item.input,
          timeoutMs: item.timeoutMs,
          retries: item.retries,
        })),
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxOutputTokens !== undefined ? { maxOutputTokens: dto.maxOutputTokens } : {}),
      },
      output: {},
      startedAt,
      tokenUsage: {},
    });

    const executorGenerator = this.agentExecutor.executeStream(
      agent,
      run,
      dto,
      grantedPermissions,
      signal,
    );

    try {
      let step = await executorGenerator.next();
      while (!step.done) {
        yield step.value;
        step = await executorGenerator.next();
      }
      const result = step.value;

      const completedAt = new Date();
      const updatedRun = await this.agentRepository.updateAgentRun(run.id, {
        status: 'SUCCEEDED',
        output: this.agentFactory.buildRunOutput({
          outputText: result.outputText,
          finishReason: result.finishReason,
          toolResults: result.toolResults,
          assistantMessage: result.assistantMessage,
        }),
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        tokenUsage: result.tokenUsage,
        error: null,
      });

      await this.auditService.record({
        action: 'run',
        resource: 'ai_agent',
        resourceId: agent.id,
        metadata: {
          runId: updatedRun.id,
          conversationId: dto.conversationId,
          provider: agent.provider,
          model: agent.model,
          toolCount: result.toolMessages.length,
        },
      });

      yield { type: 'status', status: 'completed' };

      return {
        run: AgentRunResponseDto.fromEntity(updatedRun),
        userMessage: result.userMessage,
        toolMessages: result.toolMessages,
        assistantMessage: result.assistantMessage,
      };
    } catch (error) {
      const completedAt = new Date();
      const cancelled = isAbortError(error);
      const status = cancelled
        ? 'TIMED_OUT'
        : error instanceof Error && error.message.toLowerCase().includes('timed out')
          ? 'TIMED_OUT'
          : 'FAILED';
      const errorMessage = error instanceof Error ? error.message : 'Agent execution failed';

      await this.agentRepository.updateAgentRun(run.id, {
        status,
        output: {},
        completedAt,
        durationMs: completedAt.getTime() - startedAt.getTime(),
        tokenUsage: {},
        error: errorMessage,
      });

      await this.auditService.record({
        action: 'run',
        resource: 'ai_agent',
        resourceId: agent.id,
        metadata: {
          runId: run.id,
          conversationId: dto.conversationId,
          status,
          error: errorMessage,
        },
      });

      yield { type: 'status', status: cancelled ? 'cancelled' : 'failed' };

      throw error;
    }
  }

  async runAutonomousAgent(
    id: string,
    dto: RunAutonomousAgentDto,
    grantedPermissions: string[] = [],
  ): Promise<RunAgentResponseDto> {
    return drainToReturnValue(this.runAutonomousAgentStream(id, dto, grantedPermissions));
  }

  /**
   * Phase 1/2 autonomous execution: creates the root AgentRun (depth 0, no
   * parent, rootRunId pointing at itself) and a fresh multi-agent
   * coordination budget, then delegates all run-and-finalize bookkeeping to
   * MultiAgentOrchestratorService.runAgent — the same method used for
   * every delegated child, so this logic exists in exactly one place
   * regardless of where in the execution tree a run sits. If the model
   * never delegates, this behaves exactly like the Phase 1 single-agent
   * loop. Reachable only via the /run/autonomous(/stream) endpoints — the
   * existing /run endpoint and its behavior are completely untouched.
   */
  async *runAutonomousAgentStream(
    id: string,
    dto: RunAutonomousAgentDto,
    grantedPermissions: string[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<AiGatewayStreamEvent | MultiAgentStreamEvent, RunAgentResponseDto> {
    yield { type: 'status', status: 'queued' };

    await this.agentRegistry.ensureSystemAgents();
    const agent = await this.getAgentOrThrow(id);
    if (!agent.enabled) {
      throw new BadRequestException(`Agent "${agent.name}" is disabled`);
    }

    yield { type: 'status', status: 'processing' };

    // Generated client-side so rootRunId can point at the run's own id in
    // the same insert — a root run is the root of its own coordination.
    const rootRunId = randomUUID();
    const run = await this.agentRepository.createAgentRun({
      id: rootRunId,
      agentId: agent.id,
      conversationId: dto.conversationId,
      parentRunId: null,
      rootRunId,
      depth: 0,
      status: 'RUNNING',
      input: {
        mode: 'autonomous',
        objective: dto.objective,
        workspaceContext: dto.workspaceContext ?? [],
        ...(dto.temperature !== undefined ? { temperature: dto.temperature } : {}),
        ...(dto.maxOutputTokens !== undefined ? { maxOutputTokens: dto.maxOutputTokens } : {}),
        ...(dto.maxIterations !== undefined ? { maxIterations: dto.maxIterations } : {}),
        ...(dto.maxToolCalls !== undefined ? { maxToolCalls: dto.maxToolCalls } : {}),
        ...(dto.timeoutMs !== undefined ? { timeoutMs: dto.timeoutMs } : {}),
      },
      output: {},
      startedAt: new Date(),
      tokenUsage: {},
    });

    const coordinationState =
      this.multiAgentOrchestratorService.createCoordinationStateForRoot(rootRunId);

    const orchestratorGenerator = this.multiAgentOrchestratorService.runAgent(
      agent,
      run,
      {
        objective: dto.objective,
        workspaceContext: dto.workspaceContext,
        temperature: dto.temperature,
        maxOutputTokens: dto.maxOutputTokens,
        maxIterations: dto.maxIterations,
        maxToolCalls: dto.maxToolCalls,
        timeoutMs: dto.timeoutMs,
      },
      coordinationState,
      grantedPermissions,
      signal,
    );

    try {
      let step = await orchestratorGenerator.next();
      while (!step.done) {
        yield step.value;
        step = await orchestratorGenerator.next();
      }
      const result = step.value;

      yield { type: 'status', status: 'completed' };

      const updatedRun = await this.agentRepository.findRunById(run.id);
      if (!updatedRun) {
        throw new NotFoundException(`Agent run with id "${run.id}" not found after completion`);
      }

      return {
        run: AgentRunResponseDto.fromEntity(updatedRun),
        userMessage: result.userMessage,
        toolMessages: result.toolMessages,
        assistantMessage: result.assistantMessage,
      };
    } catch (error) {
      yield { type: 'status', status: isAbortError(error) ? 'cancelled' : 'failed' };
      throw error;
    }
  }

  /**
   * Observability: the full execution tree for a coordinated multi-agent
   * run (or a single-agent run, which is simply a tree of one) — every
   * descendant AgentRun, reusing AgentRunEntity/AgentRunResponseDto
   * unchanged.
   */
  async getExecutionTree(runId: string): Promise<AgentRunResponseDto[]> {
    const rootCandidate = await this.agentRepository.findRunById(runId);
    if (!rootCandidate) {
      throw new NotFoundException(`Agent run with id "${runId}" not found`);
    }

    const rootRunId = rootCandidate.rootRunId ?? rootCandidate.id;
    const runs = await this.agentRepository.listRunsInTree(rootRunId);
    return runs.map((run) => AgentRunResponseDto.fromEntity(run));
  }

  private async getAgentOrThrow(id: string): Promise<AgentEntity> {
    const agent = await this.agentRepository.findAgentById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with id "${id}" not found`);
    }

    return agent;
  }

  private async assertUniqueName(name: string, ignoreId?: string): Promise<void> {
    const existing = await this.agentRepository.findAgentByName(name.trim(), true);
    if (existing && existing.id !== ignoreId) {
      throw new ConflictException(`Agent with name "${name.trim()}" already exists`);
    }
  }
}

function normalizeConfiguration(
  value: Record<string, unknown> | undefined,
  kind: 'system' | 'custom',
): Record<string, unknown> {
  return {
    ...(value ?? {}),
    kind: typeof value?.kind === 'string' ? value.kind : kind,
  };
}

function getConfigurationKind(agent: AgentEntity): 'system' | 'custom' {
  return agent.configuration.kind === 'system' ? 'system' : 'custom';
}
