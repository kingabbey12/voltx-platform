import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

export interface CreateAiUsageLogData {
  organizationId: string;
  userId: string;
  conversationId?: string;
  agentId?: string;
  agentRunId?: string;
  requestType: Prisma.AiUsageLogCreateInput['requestType'];
  provider?: string;
  model?: string;
  toolName?: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  durationMs?: number;
  succeeded: boolean;
  errorMessage?: string;
}

export interface AgentRunUsageSummary {
  callCount: number;
  totalTokens: number;
  totalCostUsd: number;
  totalDurationMs: number;
}

@Injectable()
export class AiUsageRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAiUsageLogData): Promise<void> {
    await this.prisma.system.aiUsageLog.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        conversationId: data.conversationId,
        agentId: data.agentId,
        agentRunId: data.agentRunId,
        requestType: data.requestType,
        provider: data.provider,
        model: data.model,
        toolName: data.toolName,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        estimatedCostUsd: data.estimatedCostUsd,
        durationMs: data.durationMs,
        succeeded: data.succeeded,
        errorMessage: data.errorMessage,
      },
    });
  }

  /**
   * Aggregates every LLM call and tool execution already logged for a run
   * (each carries agentRunId via the existing usage ledger) into a single
   * cost/duration/iteration observability summary — reuses VT-019's usage
   * ledger rather than tracking cost a second time.
   */
  async summarizeForAgentRun(agentRunId: string): Promise<AgentRunUsageSummary> {
    const tenant = this.tenantContextService.getOrThrow();
    const result = await this.prisma.system.aiUsageLog.aggregate({
      where: { agentRunId, organizationId: tenant.organizationId },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true, durationMs: true },
    });

    return {
      callCount: result._count._all,
      totalTokens: result._sum.totalTokens ?? 0,
      totalCostUsd: result._sum.estimatedCostUsd ? Number(result._sum.estimatedCostUsd) : 0,
      totalDurationMs: result._sum.durationMs ?? 0,
    };
  }

  /**
   * Same aggregation as summarizeForAgentRun, scoped by organization +
   * request type + a recency window instead of a single run — used by the
   * Knowledge stats endpoint to report embedding latency/volume without a
   * second, parallel usage-tracking table.
   */
  async summarizeByRequestType(
    organizationId: string,
    requestType: Prisma.AiUsageLogCreateInput['requestType'],
    sinceMs: number,
  ): Promise<AgentRunUsageSummary> {
    const since = new Date(Date.now() - sinceMs);
    const result = await this.prisma.system.aiUsageLog.aggregate({
      where: { organizationId, requestType, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true, durationMs: true },
    });

    return {
      callCount: result._count._all,
      totalTokens: result._sum.totalTokens ?? 0,
      totalCostUsd: result._sum.estimatedCostUsd ? Number(result._sum.estimatedCostUsd) : 0,
      totalDurationMs: result._sum.durationMs ?? 0,
    };
  }

  /**
   * Same aggregation as summarizeByRequestType, but across every request
   * type for the organization — what the Finance Assistant's AI-cost tool
   * and the AI Operator dashboard's performance view both need ("total AI
   * spend this period"), neither of which cares about one specific
   * request type the way the Knowledge stats endpoint does.
   */
  async summarizeForOrganization(
    organizationId: string,
    sinceMs: number,
  ): Promise<AgentRunUsageSummary> {
    const since = new Date(Date.now() - sinceMs);
    const result = await this.prisma.system.aiUsageLog.aggregate({
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true, durationMs: true },
    });

    return {
      callCount: result._count._all,
      totalTokens: result._sum.totalTokens ?? 0,
      totalCostUsd: result._sum.estimatedCostUsd ? Number(result._sum.estimatedCostUsd) : 0,
      totalDurationMs: result._sum.durationMs ?? 0,
    };
  }

  /** Per-agent cost/usage breakdown for the AI Operator dashboard's performance view — agentId is null for non-agent chat/embedding calls, grouped separately from named agents. */
  async summarizeByAgent(
    organizationId: string,
    sinceMs: number,
  ): Promise<
    Array<{ agentId: string | null; callCount: number; totalTokens: number; totalCostUsd: number }>
  > {
    const since = new Date(Date.now() - sinceMs);
    const grouped = await this.prisma.system.aiUsageLog.groupBy({
      by: ['agentId'],
      where: { organizationId, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { totalTokens: true, estimatedCostUsd: true },
    });

    return grouped.map((row) => ({
      agentId: row.agentId,
      callCount: row._count._all,
      totalTokens: row._sum.totalTokens ?? 0,
      totalCostUsd: row._sum.estimatedCostUsd ? Number(row._sum.estimatedCostUsd) : 0,
    }));
  }
}
