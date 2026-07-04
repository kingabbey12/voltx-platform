import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { toAgentEntity, toAgentRunEntity, toJsonValue } from './entities/agent.mapper';
import { AgentEntity } from './entities/agent.entity';
import { AgentRunEntity, AgentRunStatus } from './entities/agent-run.entity';

export interface CreateAgentData {
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  configuration?: Record<string, unknown>;
  enabled?: boolean;
}

export interface UpdateAgentData {
  name?: string;
  description?: string;
  systemPrompt?: string;
  provider?: string;
  model?: string;
  configuration?: Record<string, unknown>;
  enabled?: boolean;
}

export interface CreateAgentRunData {
  agentId: string;
  conversationId: string;
  status: AgentRunStatus;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  startedAt: Date;
  completedAt?: Date | null;
  durationMs?: number | null;
  tokenUsage?: Record<string, unknown>;
  error?: string | null;
}

export interface UpdateAgentRunData {
  status?: AgentRunStatus;
  output?: Record<string, unknown>;
  completedAt?: Date | null;
  durationMs?: number | null;
  tokenUsage?: Record<string, unknown>;
  error?: string | null;
}

interface AgentRecord {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  configuration: Prisma.JsonValue;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

interface AgentRunRecord {
  id: string;
  agentId: string;
  conversationId: string;
  status: AgentRunStatus;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue;
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  tokenUsage: Prisma.JsonValue;
  error: string | null;
  createdAt: Date;
}

interface AgentClient {
  create(args: {
    data: {
      organizationId: string;
      name: string;
      description: string;
      systemPrompt: string;
      provider: string;
      model: string;
      configuration: Prisma.InputJsonValue | Record<string, never>;
      enabled: boolean;
      deletedAt?: Date | null;
    };
  }): Promise<AgentRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<AgentRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<AgentRecord[]>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<AgentRecord>;
}

interface AgentRunClient {
  create(args: {
    data: {
      agentId: string;
      conversationId: string;
      status: AgentRunStatus;
      input: Prisma.InputJsonValue | Record<string, never>;
      output: Prisma.InputJsonValue | Record<string, never>;
      startedAt: Date;
      completedAt?: Date | null;
      durationMs?: number | null;
      tokenUsage: Prisma.InputJsonValue | Record<string, never>;
      error?: string | null;
    };
  }): Promise<AgentRunRecord>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<AgentRunRecord>;
}

@Injectable()
export class AgentRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async listAgents(): Promise<AgentEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.agents().findMany({
      where: {
        organizationId: tenant.organizationId,
        deletedAt: null,
      },
      orderBy: [{ enabled: 'desc' }, { name: 'asc' }],
    });

    return records.map(toAgentEntity);
  }

  async findAgentById(id: string): Promise<AgentEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.agents().findFirst({
      where: {
        id,
        organizationId: tenant.organizationId,
        deletedAt: null,
      },
    });

    return record ? toAgentEntity(record) : null;
  }

  async findAgentByName(name: string, includeDeleted = false): Promise<AgentEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.agents().findFirst({
      where: {
        name,
        organizationId: tenant.organizationId,
        ...(includeDeleted ? {} : { deletedAt: null }),
      },
    });

    return record ? toAgentEntity(record) : null;
  }

  async createAgent(data: CreateAgentData): Promise<AgentEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.agents().create({
      data: {
        organizationId: tenant.organizationId,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        provider: data.provider,
        model: data.model,
        configuration: toJsonValue(data.configuration) ?? {},
        enabled: data.enabled ?? true,
      },
    });

    return toAgentEntity(record);
  }

  async updateAgent(id: string, data: UpdateAgentData): Promise<AgentEntity | null> {
    const existing = await this.findAgentById(id);
    if (!existing) {
      return null;
    }

    const record = await this.agents().update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.systemPrompt !== undefined ? { systemPrompt: data.systemPrompt } : {}),
        ...(data.provider !== undefined ? { provider: data.provider } : {}),
        ...(data.model !== undefined ? { model: data.model } : {}),
        ...(data.configuration !== undefined
          ? { configuration: toJsonValue(data.configuration) ?? {} }
          : {}),
        ...(data.enabled !== undefined ? { enabled: data.enabled } : {}),
      },
    });

    return toAgentEntity(record);
  }

  async softDeleteAgent(id: string): Promise<AgentEntity | null> {
    const existing = await this.findAgentById(id);
    if (!existing) {
      return null;
    }

    const record = await this.agents().update({
      where: { id },
      data: {
        deletedAt: new Date(),
        enabled: false,
      },
    });

    return toAgentEntity(record);
  }

  async createAgentRun(data: CreateAgentRunData): Promise<AgentRunEntity> {
    const record = await this.agentRuns().create({
      data: {
        agentId: data.agentId,
        conversationId: data.conversationId,
        status: data.status,
        input: toJsonValue(data.input) ?? {},
        output: toJsonValue(data.output) ?? {},
        startedAt: data.startedAt,
        completedAt: data.completedAt ?? null,
        durationMs: data.durationMs ?? null,
        tokenUsage: toJsonValue(data.tokenUsage) ?? {},
        error: data.error ?? null,
      },
    });

    return toAgentRunEntity(record);
  }

  async updateAgentRun(id: string, data: UpdateAgentRunData): Promise<AgentRunEntity> {
    const record = await this.agentRuns().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.output !== undefined ? { output: toJsonValue(data.output) ?? {} } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
        ...(data.tokenUsage !== undefined
          ? { tokenUsage: toJsonValue(data.tokenUsage) ?? {} }
          : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
      },
    });

    return toAgentRunEntity(record);
  }

  private agents(): AgentClient {
    return (this.prisma.system as unknown as { agent: AgentClient }).agent;
  }

  private agentRuns(): AgentRunClient {
    return (this.prisma.system as unknown as { agentRun: AgentRunClient }).agentRun;
  }
}
