import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';

export type AgentRunStepType =
  | 'PLAN'
  | 'REASONING'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'TOOL_ERROR'
  | 'FINAL_ANSWER'
  | 'DELEGATION_START'
  | 'DELEGATION_RESULT';

export interface CreateAgentRunStepData {
  agentRunId: string;
  stepNumber: number;
  type: AgentRunStepType;
  summary: string;
  toolName?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
}

export interface AgentRunStepRecord {
  id: string;
  agentRunId: string;
  stepNumber: number;
  type: AgentRunStepType;
  summary: string;
  toolName: string | null;
  input: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  createdAt: Date;
}

interface RawAgentRunStepRecord {
  id: string;
  agentRunId: string;
  stepNumber: number;
  type: AgentRunStepType;
  summary: string;
  toolName: string | null;
  input: Prisma.JsonValue | null;
  output: Prisma.JsonValue | null;
  createdAt: Date;
}

interface AgentRunStepClient {
  create(args: {
    data: {
      agentRunId: string;
      stepNumber: number;
      type: AgentRunStepType;
      summary: string;
      toolName?: string;
      input?: Prisma.InputJsonValue;
      output?: Prisma.InputJsonValue;
    };
  }): Promise<RawAgentRunStepRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: { stepNumber: 'asc' };
  }): Promise<RawAgentRunStepRecord[]>;
}

/**
 * Durable, queryable step-by-step history for an autonomous agent run —
 * "Agent State" persistence: current step, completed steps, tool history,
 * and a reasoning summary all live here, independent of the coarse
 * AgentRun.status/output fields.
 */
@Injectable()
export class AgentRunStepRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAgentRunStepData): Promise<AgentRunStepRecord> {
    const record = await this.client().create({
      data: {
        agentRunId: data.agentRunId,
        stepNumber: data.stepNumber,
        type: data.type,
        summary: data.summary,
        toolName: data.toolName,
        input: data.input as Prisma.InputJsonValue | undefined,
        output: data.output as Prisma.InputJsonValue | undefined,
      },
    });

    return toRecord(record);
  }

  async listForRun(agentRunId: string): Promise<AgentRunStepRecord[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { agentRunId, agentRun: { agent: { organizationId: tenant.organizationId } } },
      orderBy: { stepNumber: 'asc' },
    });

    return records.map(toRecord);
  }

  private client(): AgentRunStepClient {
    return (this.prisma.system as unknown as { agentRunStep: AgentRunStepClient }).agentRunStep;
  }
}

function toRecord(record: RawAgentRunStepRecord): AgentRunStepRecord {
  return {
    id: record.id,
    agentRunId: record.agentRunId,
    stepNumber: record.stepNumber,
    type: record.type,
    summary: record.summary,
    toolName: record.toolName,
    input: toObjectOrNull(record.input),
    output: toObjectOrNull(record.output),
    createdAt: record.createdAt,
  };
}

function toObjectOrNull(value: Prisma.JsonValue | null): Record<string, unknown> | null {
  if (value === null) {
    return null;
  }

  return typeof value === 'object' && !Array.isArray(value) ? value : null;
}
