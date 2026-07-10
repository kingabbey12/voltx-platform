import { Injectable, OnModuleInit } from '@nestjs/common';
import { AiUsageService } from '../../ai/gateway/ai-usage.service';
import { AITool, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { OpportunitiesService } from '../opportunities/opportunities.service';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Gives the Finance Assistant real financial-analysis data — deliberately
 * analysis-only, since this codebase has no Invoice/Expense/Budget model
 * to manage. Reuses the exact same data the Sales module and AI usage
 * ledger already track (SalesOpportunity.amount, AiUsageLog) rather than
 * introducing a parallel bookkeeping system, mirroring
 * SalesToolSourceService's "wrap the real service, no parallel logic"
 * convention exactly.
 */
@Injectable()
export class FinanceToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly opportunitiesService: OpportunitiesService,
    private readonly aiUsageService: AiUsageService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return [
      this.buildRevenueSummaryTool(),
      this.buildPipelineSummaryTool(),
      this.buildAiCostSummaryTool(),
    ];
  }

  private buildRevenueSummaryTool(): AITool {
    const opportunitiesService = this.opportunitiesService;
    const schema: ToolSchema = { type: 'object', properties: {} };

    return {
      name: 'get_revenue_summary',
      description:
        'Summarize closed-won revenue from the CRM pipeline: total closed-won amount, deal count, and average deal size, grouped by currency.',
      inputSchema: schema,
      async execute() {
        const result = await opportunitiesService.findAll({
          page: 1,
          limit: 100,
          stage: 'CLOSED_WON',
        });

        const byCurrency = new Map<string, { totalAmount: number; dealCount: number }>();
        for (const item of result.items) {
          const currency = item.currency ?? 'USD';
          const bucket = byCurrency.get(currency) ?? { totalAmount: 0, dealCount: 0 };
          bucket.totalAmount += item.amount ?? 0;
          bucket.dealCount += 1;
          byCurrency.set(currency, bucket);
        }

        return {
          currencies: Array.from(byCurrency.entries()).map(([currency, bucket]) => ({
            currency,
            totalAmount: bucket.totalAmount,
            dealCount: bucket.dealCount,
            averageDealSize: bucket.dealCount > 0 ? bucket.totalAmount / bucket.dealCount : 0,
          })),
        };
      },
    };
  }

  private buildPipelineSummaryTool(): AITool {
    const opportunitiesService = this.opportunitiesService;
    const schema: ToolSchema = { type: 'object', properties: {} };
    const openStages = ['DISCOVERY', 'QUALIFICATION', 'PROPOSAL', 'NEGOTIATION'] as const;

    return {
      name: 'get_pipeline_summary',
      description:
        'Summarize open (not yet closed) CRM pipeline value by stage: deal count and total amount per stage (DISCOVERY, QUALIFICATION, PROPOSAL, NEGOTIATION).',
      inputSchema: schema,
      async execute() {
        const byStage = await Promise.all(
          openStages.map(async (stage) => {
            const result = await opportunitiesService.findAll({ page: 1, limit: 100, stage });
            const totalAmount = result.items.reduce((sum, item) => sum + (item.amount ?? 0), 0);
            return { stage, dealCount: result.items.length, totalAmount };
          }),
        );

        return {
          stages: byStage,
          totalOpenPipelineValue: byStage.reduce((sum, entry) => sum + entry.totalAmount, 0),
        };
      },
    };
  }

  private buildAiCostSummaryTool(): AITool {
    const aiUsageService = this.aiUsageService;
    const tenantContextService = this.tenantContextService;
    const schema: ToolSchema = {
      type: 'object',
      properties: {
        lookbackDays: {
          type: 'number',
          description: 'How many days back to summarize AI usage/cost for. Default 30.',
        },
      },
    };

    return {
      name: 'get_ai_cost_summary',
      description:
        "Summarize this organization's AI operating cost: total estimated USD spend, token usage, and call count over a lookback window (default 30 days).",
      inputSchema: schema,
      async execute(input: { lookbackDays?: number }) {
        const tenant = tenantContextService.getOrThrow();
        const lookbackDays = input.lookbackDays && input.lookbackDays > 0 ? input.lookbackDays : 30;
        const summary = await aiUsageService.summarizeForOrganization(
          tenant.organizationId,
          lookbackDays * DAY_MS,
        );

        return {
          lookbackDays,
          totalCostUsd: summary.totalCostUsd,
          totalTokens: summary.totalTokens,
          callCount: summary.callCount,
        };
      },
    };
  }
}
