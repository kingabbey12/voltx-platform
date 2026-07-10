import { Injectable } from '@nestjs/common';
import { AgentApprovalService } from '../../approvals/agent-approval.service';
import { AiUsageService } from '../../gateway/ai-usage.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { AgentRepository } from '../agent.repository';
import { AgentRunResponseDto } from '../dto/agent.dto';
import { AgentApprovalResponseDto } from '../approvals/dto/agent-approval.dto';
import { AiSuggestionEntity } from '../entities/ai-suggestion.entity';
import { AiSuggestionService } from './ai-suggestion.service';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PaginatedActivity {
  items: AgentRunResponseDto[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AgentPerformanceEntry {
  agentId: string | null;
  agentName: string | null;
  callCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface AiPerformanceSummary {
  lookbackDays: number;
  totalCallCount: number;
  totalTokens: number;
  totalCostUsd: number;
  byAgent: AgentPerformanceEntry[];
}

export interface AiTasksSummary {
  pendingApprovals: AgentApprovalResponseDto[];
  inProgressRuns: AgentRunResponseDto[];
}

/**
 * Composes the AI Operator dashboard's four views from repositories/
 * services that already exist — no new aggregation logic beyond
 * AiUsageRepository.summarizeByAgent (added alongside this), which is a
 * thin groupBy over the existing usage ledger.
 */
@Injectable()
export class AiDashboardService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly agentApprovalService: AgentApprovalService,
    private readonly aiUsageService: AiUsageService,
    private readonly aiSuggestionService: AiSuggestionService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async getActivity(page: number, limit: number): Promise<PaginatedActivity> {
    const result = await this.agentRepository.listRecentRunsForOrganization({ page, limit });
    return {
      items: result.items.map((run) => AgentRunResponseDto.fromEntity(run)),
      total: result.total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(result.total / limit)),
    };
  }

  async getPerformance(lookbackDays: number): Promise<AiPerformanceSummary> {
    const tenant = this.tenantContextService.getOrThrow();
    const sinceMs = lookbackDays * DAY_MS;

    const [overall, byAgentRaw, agents] = await Promise.all([
      this.aiUsageService.summarizeForOrganization(tenant.organizationId, sinceMs),
      this.aiUsageService.summarizeByAgent(tenant.organizationId, sinceMs),
      this.agentRepository.listAgents(),
    ]);

    const nameById = new Map(agents.map((agent) => [agent.id, agent.name]));

    return {
      lookbackDays,
      totalCallCount: overall.callCount,
      totalTokens: overall.totalTokens,
      totalCostUsd: overall.totalCostUsd,
      byAgent: byAgentRaw.map((entry) => ({
        agentId: entry.agentId,
        agentName: entry.agentId ? (nameById.get(entry.agentId) ?? null) : null,
        callCount: entry.callCount,
        totalTokens: entry.totalTokens,
        totalCostUsd: entry.totalCostUsd,
      })),
    };
  }

  async getTasks(): Promise<AiTasksSummary> {
    const [pending, running, waitingApproval] = await Promise.all([
      this.agentApprovalService.listPending(1, 50),
      this.agentRepository.listRecentRunsForOrganization({ page: 1, limit: 25, status: 'RUNNING' }),
      this.agentRepository.listRecentRunsForOrganization({
        page: 1,
        limit: 25,
        status: 'WAITING_APPROVAL',
      }),
    ]);

    return {
      pendingApprovals: pending.items.map((item) => AgentApprovalResponseDto.fromEntity(item)),
      inProgressRuns: [...running.items, ...waitingApproval.items].map((run) =>
        AgentRunResponseDto.fromEntity(run),
      ),
    };
  }

  async getSuggestions(): Promise<AiSuggestionEntity[]> {
    return this.aiSuggestionService.getOrGenerate();
  }

  async dismissSuggestion(id: string): Promise<void> {
    await this.aiSuggestionService.dismiss(id);
  }
}
