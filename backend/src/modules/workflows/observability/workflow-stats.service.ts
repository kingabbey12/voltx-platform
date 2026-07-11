import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { WorkflowRunRepository } from '../workflow-run.repository';
import { WorkflowRetryRepository } from '../workflow-retry.repository';
import { WorkflowStepRunRepository } from '../workflow-step-run.repository';

export interface WorkflowMetrics {
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  successRate: number;
  failureRate: number;
  averageExecutionTimeMs: number;
  averageQueueTimeMs: number;
  totalRetries: number;
  agentStepCount: number;
  toolStepCount: number;
  totalTokens: number;
  totalCostUsd: number;
}

export interface WorkflowHealth {
  healthy: boolean;
  reasons: string[];
}

/**
 * Aggregates the admin metrics/health surface from data already tracked
 * elsewhere (WorkflowRun/WorkflowStepRun/WorkflowRetryAttempt rows, and
 * the existing AiUsageLog ledger via each run's shared conversation) —
 * no parallel metrics store, matching KnowledgeStatsService's convention
 * in the sibling module.
 */
@Injectable()
export class WorkflowStatsService {
  constructor(
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly workflowRetryRepository: WorkflowRetryRepository,
    private readonly workflowStepRunRepository: WorkflowStepRunRepository,
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async getMetrics(workflowId: string): Promise<WorkflowMetrics> {
    const [runAggregate, totalRetries, agentStepCount, toolStepCount, usage] = await Promise.all([
      this.workflowRunRepository.aggregateForWorkflow(workflowId),
      this.workflowRetryRepository.countByWorkflow(workflowId),
      this.workflowStepRunRepository.countByWorkflowAndType(workflowId, 'AGENT'),
      this.workflowStepRunRepository.countByWorkflowAndType(workflowId, 'TOOL'),
      this.summarizeUsage(workflowId),
    ]);

    const terminalRuns = runAggregate.succeededRuns + runAggregate.failedRuns;

    return {
      totalRuns: runAggregate.totalRuns,
      succeededRuns: runAggregate.succeededRuns,
      failedRuns: runAggregate.failedRuns,
      cancelledRuns: runAggregate.cancelledRuns,
      successRate: terminalRuns === 0 ? 0 : runAggregate.succeededRuns / terminalRuns,
      failureRate: terminalRuns === 0 ? 0 : runAggregate.failedRuns / terminalRuns,
      averageExecutionTimeMs: runAggregate.averageDurationMs,
      averageQueueTimeMs: runAggregate.averageQueueMs,
      totalRetries,
      agentStepCount,
      toolStepCount,
      totalTokens: usage.totalTokens,
      totalCostUsd: usage.totalCostUsd,
    };
  }

  async getHealth(workflowId: string): Promise<WorkflowHealth> {
    const metrics = await this.getMetrics(workflowId);
    const reasons: string[] = [];

    if (metrics.totalRuns > 0 && metrics.failureRate > 0.5) {
      reasons.push('More than half of recent runs have failed');
    }
    if (metrics.totalRuns === 0) {
      reasons.push('This workflow has never been run');
    }

    return { healthy: reasons.length === 0, reasons };
  }

  private async summarizeUsage(
    workflowId: string,
  ): Promise<{ totalTokens: number; totalCostUsd: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.prisma.system.$queryRaw<
      Array<{ total_tokens: number | null; total_cost_usd: number | null }>
    >`
      SELECT
        SUM(u.total_tokens) AS total_tokens,
        SUM(u.estimated_cost_usd) AS total_cost_usd
      FROM ai_usage_logs u
      WHERE u.organization_id = ${tenant.organizationId}::uuid
        AND u.conversation_id IN (
          SELECT conversation_id FROM workflow_runs WHERE workflow_id = ${workflowId}::uuid
        )
    `;

    const row = rows[0];
    return {
      // SUM(int) returns Postgres bigint — Prisma's $queryRaw surfaces
      // that as a native JS BigInt, which JSON.stringify cannot serialize
      // (crashes the response with "Do not know how to serialize a
      // BigInt"). Must convert, same as totalCostUsd below.
      totalTokens: row?.total_tokens ? Number(row.total_tokens) : 0,
      totalCostUsd: row?.total_cost_usd ? Number(row.total_cost_usd) : 0,
    };
  }
}
