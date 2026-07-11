import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';

export type AgentMessageType = 'REQUEST' | 'RESPONSE' | 'STATUS' | 'OBSERVATION' | 'COMPLETION';

export interface CreateAgentMessageData {
  rootRunId: string;
  fromAgentRunId: string;
  toAgentRunId?: string;
  type: AgentMessageType;
  content: string;
  payload?: Record<string, unknown>;
}

export interface AgentMessageRecord {
  id: string;
  rootRunId: string;
  fromAgentRunId: string;
  toAgentRunId: string | null;
  type: AgentMessageType;
  content: string;
  payload: Record<string, unknown>;
  createdAt: Date;
}

interface RawAgentMessageRecord {
  id: string;
  rootRunId: string;
  fromAgentRunId: string;
  toAgentRunId: string | null;
  type: AgentMessageType;
  content: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

interface AgentMessageClient {
  create(args: {
    data: {
      rootRunId: string;
      fromAgentRunId: string;
      toAgentRunId?: string;
      type: AgentMessageType;
      content: string;
      payload: Prisma.InputJsonValue;
    };
  }): Promise<RawAgentMessageRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: { createdAt: 'asc' };
  }): Promise<RawAgentMessageRecord[]>;
}

/**
 * Structured agent-to-agent communication log — the "Agent Communication"
 * and "delegation history" persistence requirement. Distinct from the
 * user-facing Conversation/Message transcript: this is internal
 * coordinator/agent traffic (requests, responses, status, observations,
 * completions), keyed by the coordination's root run so a whole tree's
 * message history is one indexed query.
 */
@Injectable()
export class AgentMessageRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAgentMessageData): Promise<AgentMessageRecord> {
    const record = await this.client().create({
      data: {
        rootRunId: data.rootRunId,
        fromAgentRunId: data.fromAgentRunId,
        toAgentRunId: data.toAgentRunId,
        type: data.type,
        content: data.content,
        payload: (data.payload ?? {}) as Prisma.InputJsonValue,
      },
    });

    return toRecord(record);
  }

  async listForRoot(rootRunId: string): Promise<AgentMessageRecord[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { rootRunId, fromAgentRun: { agent: { organizationId: tenant.organizationId } } },
      orderBy: { createdAt: 'asc' },
    });

    return records.map(toRecord);
  }

  private client(): AgentMessageClient {
    return (this.prisma.system as unknown as { agentMessage: AgentMessageClient }).agentMessage;
  }
}

function toRecord(record: RawAgentMessageRecord): AgentMessageRecord {
  return {
    id: record.id,
    rootRunId: record.rootRunId,
    fromAgentRunId: record.fromAgentRunId,
    toAgentRunId: record.toAgentRunId,
    type: record.type,
    content: record.content,
    payload: toObject(record.payload),
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
