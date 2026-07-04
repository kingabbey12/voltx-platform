import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { ModelRegistryService } from '../models/model-registry.service';
import { AgentExecutor } from './agent.executor';
import { AgentFactory } from './agent.factory';
import { AgentRegistry } from './agent.registry';
import { AgentRepository } from './agent.repository';
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

  async runAgent(id: string, dto: RunAgentDto): Promise<RunAgentResponseDto> {
    await this.agentRegistry.ensureSystemAgents();
    const agent = await this.getAgentOrThrow(id);
    if (!agent.enabled) {
      throw new BadRequestException(`Agent "${agent.name}" is disabled`);
    }

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

    try {
      const result = await this.agentExecutor.execute(agent, run, dto);
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

      return {
        run: AgentRunResponseDto.fromEntity(updatedRun),
        userMessage: result.userMessage,
        toolMessages: result.toolMessages,
        assistantMessage: result.assistantMessage,
      };
    } catch (error) {
      const completedAt = new Date();
      const status =
        error instanceof Error && error.message.toLowerCase().includes('timed out')
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

      throw error;
    }
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
