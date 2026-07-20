import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  AgentActionApprovalEntity,
  AgentActionApprovalStatus,
} from './entities/agent-action-approval.entity';

export interface CreateAgentActionApprovalData {
  agentRunId: string;
  toolName: string;
  input: Record<string, unknown>;
  summary?: string;
  expiresAt?: Date;
}

export interface DecideAgentActionApprovalData {
  status: 'APPROVED' | 'REJECTED';
  approverUserId: string;
  comment?: string;
}

export interface PaginatedAgentActionApprovals {
  items: AgentActionApprovalEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class AgentApprovalRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAgentActionApprovalData): Promise<AgentActionApprovalEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.createUnscoped(tenant.organizationId, data);
  }

  /** Tool execution can run outside a request's tenant context (a resumed/queued continuation) — resolved organizationId is passed explicitly, same *Unscoped convention used across this codebase. */
  async createUnscoped(
    organizationId: string,
    data: CreateAgentActionApprovalData,
  ): Promise<AgentActionApprovalEntity> {
    const record = await this.prisma.system.agentActionApproval.create({
      data: {
        organizationId,
        agentRunId: data.agentRunId,
        toolName: data.toolName,
        input: data.input as Prisma.InputJsonValue,
        summary: data.summary ?? null,
        expiresAt: data.expiresAt,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<AgentActionApprovalEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.prisma.system.agentActionApproval.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findByIdUnscoped(id: string): Promise<AgentActionApprovalEntity | null> {
    const record = await this.prisma.system.agentActionApproval.findFirst({ where: { id } });
    return record ? toEntity(record) : null;
  }

  /** Resolves the still-pending approval for a specific run+tool call, if one already exists — how executeTool avoids creating a duplicate approval every time a paused run's status is polled. */
  async findPendingForRunAndTool(
    agentRunId: string,
    toolName: string,
  ): Promise<AgentActionApprovalEntity | null> {
    const record = await this.prisma.system.agentActionApproval.findFirst({
      where: { agentRunId, toolName, status: 'PENDING' },
      orderBy: { createdAt: 'desc' },
    });
    return record ? toEntity(record) : null;
  }

  async findPendingByOrganization(
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedAgentActionApprovals> {
    const where: Prisma.AgentActionApprovalWhereInput = { organizationId, status: 'PENDING' };
    const [records, total] = await Promise.all([
      this.prisma.system.agentActionApproval.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.system.agentActionApproval.count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  /**
   * Atomic compare-and-swap: the WHERE clause only matches a row still in
   * PENDING status, so of two concurrent decide() calls for the same
   * approval, Postgres's row-level locking on the UPDATE guarantees at
   * most one affects a row — the loser's `updateMany` matches zero rows
   * and this returns null rather than silently double-deciding (and, via
   * the resume path, potentially double-executing the underlying tool
   * call).
   */
  async decide(
    id: string,
    data: DecideAgentActionApprovalData,
  ): Promise<AgentActionApprovalEntity | null> {
    return this.prisma.system.$transaction(async (tx) => {
      const result = await tx.agentActionApproval.updateMany({
        where: { id, status: 'PENDING' },
        data: {
          status: data.status,
          approverUserId: data.approverUserId,
          comment: data.comment,
          decidedAt: new Date(),
        },
      });

      if (result.count === 0) {
        return null;
      }

      const record = await tx.agentActionApproval.findUniqueOrThrow({ where: { id } });
      return toEntity(record);
    });
  }
}

function toEntity(record: {
  id: string;
  organizationId: string;
  agentRunId: string;
  toolName: string;
  input: Prisma.JsonValue;
  summary: string | null;
  status: AgentActionApprovalStatus;
  approverUserId: string | null;
  comment: string | null;
  expiresAt: Date | null;
  decidedAt: Date | null;
  createdAt: Date;
}): AgentActionApprovalEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    agentRunId: record.agentRunId,
    toolName: record.toolName,
    input: toObject(record.input),
    summary: record.summary,
    status: record.status,
    approverUserId: record.approverUserId,
    comment: record.comment,
    expiresAt: record.expiresAt,
    decidedAt: record.decidedAt,
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
