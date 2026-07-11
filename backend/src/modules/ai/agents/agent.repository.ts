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
  /** Optional client-generated id — lets a root run reference its own id as rootRunId in the same insert. */
  id?: string;
  agentId: string;
  conversationId: string;
  parentRunId?: string | null;
  rootRunId?: string | null;
  depth?: number;
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
  currentStep?: number;
  iterationCount?: number;
  toolCallCount?: number;
  completedAt?: Date | null;
  durationMs?: number | null;
  tokenUsage?: Record<string, unknown>;
  error?: string | null;
}

export interface UpdateAgentRunProgressData {
  currentStep: number;
  iterationCount: number;
  toolCallCount: number;
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
  parentRunId: string | null;
  rootRunId: string | null;
  depth: number;
  status: AgentRunStatus;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue;
  currentStep: number;
  iterationCount: number;
  toolCallCount: number;
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
      id?: string;
      agentId: string;
      conversationId: string;
      parentRunId?: string | null;
      rootRunId?: string | null;
      depth?: number;
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
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  findFirst(args: {
    where: Record<string, unknown>;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<AgentRunRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
    skip?: number;
    take?: number;
  }): Promise<AgentRunRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
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

  /** Bypasses tenant scoping — for background contexts (e.g. resuming a run after an approval decision) that resolve tenant context from the run/conversation rather than an HTTP request. */
  async findAgentByIdUnscoped(id: string): Promise<AgentEntity | null> {
    const record = await this.agents().findFirst({ where: { id, deletedAt: null } });
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
        ...(data.id ? { id: data.id } : {}),
        agentId: data.agentId,
        conversationId: data.conversationId,
        parentRunId: data.parentRunId ?? null,
        rootRunId: data.rootRunId ?? null,
        depth: data.depth ?? 0,
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

  /**
   * Tenant-scoped via the owning agent's organizationId since AgentRun has
   * no direct organizationId column — matches how every other AgentRun
   * lookup in this repository defers tenant scoping to the agent.
   */
  async findRunById(id: string): Promise<AgentRunEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.agentRuns().findFirst({
      where: { id, agent: { organizationId: tenant.organizationId } },
    });

    return record ? toAgentRunEntity(record) : null;
  }

  /** Bypasses tenant scoping — see findAgentByIdUnscoped. */
  async findRunByIdUnscoped(id: string): Promise<AgentRunEntity | null> {
    const record = await this.agentRuns().findFirst({ where: { id } });
    return record ? toAgentRunEntity(record) : null;
  }

  async listChildRuns(parentRunId: string): Promise<AgentRunEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.agentRuns().findMany({
      where: { parentRunId, agent: { organizationId: tenant.organizationId } },
      orderBy: [{ createdAt: 'asc' }],
    });

    return records.map(toAgentRunEntity);
  }

  async getAgentRunStats(agentId: string): Promise<{
    totalRunCount: number;
    succeededRunCount: number;
    lastRunAt: Date | null;
  }> {
    const tenant = this.tenantContextService.getOrThrow();
    const scope = { agentId, agent: { organizationId: tenant.organizationId } };

    const [totalRunCount, succeededRunCount, lastRun] = await Promise.all([
      this.agentRuns().count({ where: scope }),
      this.agentRuns().count({ where: { ...scope, status: 'SUCCEEDED' } }),
      this.agentRuns().findFirst({
        where: scope,
        orderBy: [{ startedAt: 'desc' }],
      }),
    ]);

    return {
      totalRunCount,
      succeededRunCount,
      lastRunAt: lastRun ? toAgentRunEntity(lastRun).startedAt : null,
    };
  }

  /** Org-wide run activity feed (not scoped to one execution tree) — for the AI Operator dashboard's Activity view. */
  async listRecentRunsForOrganization(params: {
    page: number;
    limit: number;
    status?: AgentRunStatus;
  }): Promise<{ items: AgentRunEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = {
      agent: { organizationId: tenant.organizationId },
      ...(params.status ? { status: params.status } : {}),
    };

    const [records, total] = await Promise.all([
      this.agentRuns().findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.agentRuns().count({ where }),
    ]);

    return { items: records.map(toAgentRunEntity), total };
  }

  async listRunsInTree(rootRunId: string): Promise<AgentRunEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.agentRuns().findMany({
      where: {
        OR: [{ id: rootRunId }, { rootRunId }],
        agent: { organizationId: tenant.organizationId },
      },
      orderBy: [{ depth: 'asc' }, { createdAt: 'asc' }],
    });

    return records.map(toAgentRunEntity);
  }

  /**
   * Atomic compare-and-swap: only a run still in WAITING_APPROVAL can be
   * claimed for resume, and the WHERE clause is what Postgres actually
   * serializes on — of two concurrent resume attempts for the same run
   * (e.g. a redelivered/duplicated background job), only one `updateMany`
   * affects a row. The caller MUST check this before executing the
   * approved tool call, not after, or the two attempts can both execute
   * it during the window before either flips the run's status.
   */
  async claimRunForResume(id: string): Promise<boolean> {
    const result = await this.agentRuns().updateMany({
      where: { id, status: 'WAITING_APPROVAL' },
      data: { status: 'RUNNING' },
    });
    return result.count === 1;
  }

  async updateAgentRun(id: string, data: UpdateAgentRunData): Promise<AgentRunEntity> {
    const record = await this.agentRuns().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.output !== undefined ? { output: toJsonValue(data.output) ?? {} } : {}),
        ...(data.currentStep !== undefined ? { currentStep: data.currentStep } : {}),
        ...(data.iterationCount !== undefined ? { iterationCount: data.iterationCount } : {}),
        ...(data.toolCallCount !== undefined ? { toolCallCount: data.toolCallCount } : {}),
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

  /**
   * Live progress checkpoint written during an autonomous run so persisted
   * state reflects how far execution got even if the process never reaches
   * a terminal update (crash, forced kill).
   */
  async updateAgentRunProgress(id: string, data: UpdateAgentRunProgressData): Promise<void> {
    await this.agentRuns().update({
      where: { id },
      data: {
        currentStep: data.currentStep,
        iterationCount: data.iterationCount,
        toolCallCount: data.toolCallCount,
      },
    });
  }

  private agents(): AgentClient {
    return (this.prisma.system as unknown as { agent: AgentClient }).agent;
  }

  private agentRuns(): AgentRunClient {
    return (this.prisma.system as unknown as { agentRun: AgentRunClient }).agentRun;
  }
}
