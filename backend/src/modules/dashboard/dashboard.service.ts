import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  DashboardMetricsService,
  type BusinessSnapshot,
  type MetricPoint,
} from './dashboard-metrics.service';

export interface MetricChange {
  /** Absolute movement in the metric's own units. */
  absolute: number;
  /** Signed fraction, e.g. 0.124 for +12.4%. Null when there is no baseline
   *  to divide by — a rise from zero has no meaningful percentage, and
   *  reporting "+100%" for the first company added would be nonsense. */
  percent: number | null;
  /** What the comparison is against, so the frontend never has to guess. */
  comparedTo: string;
}

export interface DashboardInsight {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  explanation: string;
  /** 0–1. Present so the contract is stable; nothing produces it yet. */
  confidence: number;
}

export interface ExecutiveSnapshot {
  snapshot: BusinessSnapshot;
  trends: Record<string, MetricPoint[]>;
  changes: Record<string, MetricChange>;
  health: { score: number | null; status: 'healthy' | 'attention' | 'unknown' };
  insights: DashboardInsight[];
  meta: {
    /** Days of history behind `trends`. Zero on a workspace whose first
     *  snapshot has not run yet — the frontend uses this to decide whether a
     *  sparkline is honest, rather than inferring from array length. */
    historyDays: number;
    generatedAt: string;
  };
}

@Injectable()
export class DashboardService {
  constructor(
    private readonly metrics: DashboardMetricsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  /**
   * One request, one complete executive picture.
   *
   * The frontend previously issued four list requests and did the arithmetic
   * itself, which made it both slow and wrong. It now asks one question and
   * gets an answer that is already correct.
   */
  async getExecutiveSnapshot(days = 30): Promise<ExecutiveSnapshot> {
    // getOrThrow, not get: the raw SQL in DashboardMetricsService bypasses the
    // tenant Prisma extension, so a missing organization id must fail loudly
    // here rather than reach a query that would scan across tenants.
    const { organizationId } = this.tenantContext.getOrThrow();

    const [snapshot, trends] = await Promise.all([
      this.metrics.getSnapshot(organizationId),
      this.metrics.getTrends(organizationId, days),
    ]);

    const historyDays = trends.pipelineValue?.length ?? 0;

    return {
      snapshot,
      trends,
      changes: this.deriveChanges(snapshot, trends),
      health: this.deriveHealth(),
      // Architecture only. Populating these means running a model over the
      // snapshot, which belongs in its own service — see the module docblock.
      // Returning [] is honest; returning invented warnings would not be.
      insights: [],
      meta: { historyDays, generatedAt: new Date().toISOString() },
    };
  }

  /**
   * Change is measured against the oldest snapshot in the window, not against
   * a recomputation of the past. If there is only one snapshot there is no
   * baseline, and every change is omitted rather than reported as zero —
   * "no change" and "we don't know yet" are different statements.
   */
  private deriveChanges(
    snapshot: BusinessSnapshot,
    trends: Record<string, MetricPoint[]>,
  ): Record<string, MetricChange> {
    const changes: Record<string, MetricChange> = {};

    const compare = (key: keyof BusinessSnapshot, seriesKey: string) => {
      const series = trends[seriesKey];
      if (!series || series.length < 2) return;

      const baseline = series[0];
      const current = snapshot[key];
      const absolute = current - baseline.value;

      changes[key] = {
        absolute,
        percent: baseline.value === 0 ? null : absolute / baseline.value,
        comparedTo: `since ${baseline.date}`,
      };
    };

    compare('companies', 'companies');
    compare('contacts', 'contacts');
    compare('openOpportunities', 'opportunities');
    compare('qualifiedLeads', 'qualifiedLeads');
    compare('pipelineValue', 'pipelineValue');
    compare('wonValue', 'wonValue');

    return changes;
  }

  /**
   * Health scoring needs a defensible model — weightings, thresholds, and a
   * baseline to compare against — none of which exist yet. Returning a number
   * now would be a number someone might act on, so it returns `unknown`
   * instead. The shape is fixed so the frontend can be built against it.
   */
  private deriveHealth(): ExecutiveSnapshot['health'] {
    return { score: null, status: 'unknown' };
  }
}
