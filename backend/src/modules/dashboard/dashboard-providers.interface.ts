import type { BusinessSnapshot, MetricPoint } from './dashboard-metrics.service';

/**
 * Seams between the analytical layer and whatever eventually produces
 * intelligence from it.
 *
 * DashboardService depends on these interfaces, never on a model, a prompt or a
 * provider SDK. That keeps three things true:
 *
 *   - the dashboard contract is stable while the intelligence behind it changes
 *   - insight generation can move to a queue, a scheduled job or an external
 *     service without touching the request path
 *   - a provider that is slow, unavailable or not yet built degrades to an
 *     empty section rather than failing the whole dashboard
 *
 * Nothing implements these yet, deliberately. The null-object implementations
 * below are what the module binds today: they return nothing, which is honest,
 * rather than plausible text, which would not be.
 */

/** Everything a provider may reason over. Passed in rather than re-queried so
 *  providers cannot quietly become a second source of truth for the numbers. */
export interface DashboardContext {
  organizationId: string;
  snapshot: BusinessSnapshot;
  trends: Record<string, MetricPoint[]>;
  /** Days of real history available. Providers should decline to draw
   *  conclusions from too little of it rather than guessing. */
  historyDays: number;
}

export interface DashboardInsight {
  type: 'warning' | 'opportunity' | 'info';
  title: string;
  explanation: string;
  /** 0–1. A provider that cannot estimate its own confidence should not be
   *  emitting an insight. */
  confidence: number;
}

export interface DashboardHealth {
  /** 0–100, or null when there is not enough history to score honestly. */
  score: number | null;
  status: 'healthy' | 'attention' | 'unknown';
  /** What drove the score, so a number on a dashboard is never unexplained. */
  factors?: { label: string; impact: 'positive' | 'negative' | 'neutral' }[];
}

export interface DashboardPriority {
  id: string;
  title: string;
  /** Why this is worth attention now. */
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  /** Where acting on it begins. */
  href?: string;
}

export interface DashboardInsightProvider {
  getInsights(context: DashboardContext): Promise<DashboardInsight[]>;
}

export interface DashboardHealthProvider {
  getHealth(context: DashboardContext): Promise<DashboardHealth>;
}

export interface DashboardPriorityProvider {
  getPriorities(context: DashboardContext): Promise<DashboardPriority[]>;
}

export const DASHBOARD_INSIGHT_PROVIDER = Symbol('DASHBOARD_INSIGHT_PROVIDER');
export const DASHBOARD_HEALTH_PROVIDER = Symbol('DASHBOARD_HEALTH_PROVIDER');
export const DASHBOARD_PRIORITY_PROVIDER = Symbol('DASHBOARD_PRIORITY_PROVIDER');

/**
 * Null-object implementations — the default bindings.
 *
 * These exist so the dashboard renders its Business Health, AI Briefing and
 * Priorities sections today, in an honest empty state, and so replacing them
 * later is a single provider swap in the module rather than a change to the
 * service, the controller, the response shape or the UI.
 */

export class NoopInsightProvider implements DashboardInsightProvider {
  getInsights(): Promise<DashboardInsight[]> {
    return Promise.resolve([]);
  }
}

export class NoopHealthProvider implements DashboardHealthProvider {
  /** `unknown`, not a default score. A health number is something an executive
   *  would act on; inventing one is worse than admitting there is no model. */
  getHealth(): Promise<DashboardHealth> {
    return Promise.resolve({ score: null, status: 'unknown' });
  }
}

export class NoopPriorityProvider implements DashboardPriorityProvider {
  getPriorities(): Promise<DashboardPriority[]> {
    return Promise.resolve([]);
  }
}
