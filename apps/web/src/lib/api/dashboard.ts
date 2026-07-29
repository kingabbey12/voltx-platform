import { apiClient } from "./client";

/**
 * The presentation layer's view of the analytical layer.
 *
 * These types mirror the backend's ExecutiveSnapshot contract deliberately —
 * the dashboard consumes one endpoint and does no arithmetic of its own. It
 * previously derived pipeline value by fetching 100 opportunities and summing
 * them in the browser, which was both slow and wrong past 100 deals.
 */

export interface BusinessSnapshot {
  companies: number;
  contacts: number;
  leads: number;
  qualifiedLeads: number;
  opportunities: number;
  openOpportunities: number;
  openActivities: number;
  pipelineValue: number;
  wonValue: number;
}

export interface MetricPoint {
  date: string;
  value: number;
}

export interface MetricChange {
  absolute: number;
  /** Null when the baseline was zero — growth from nothing has no percentage. */
  percent: number | null;
  /** e.g. "since 2026-07-01". Rendered verbatim so the UI never has to guess
   *  what a change is being measured against. */
  comparedTo: string;
}

export interface DashboardHealth {
  /** Null until enough history exists to score honestly. */
  score: number | null;
  status: "healthy" | "attention" | "unknown";
  factors?: { label: string; impact: "positive" | "negative" | "neutral" }[];
}

export interface DashboardInsight {
  type: "warning" | "opportunity" | "info";
  title: string;
  explanation: string;
  confidence: number;
}

export interface DashboardPriority {
  id: string;
  title: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  href?: string;
}

export interface ExecutiveSnapshot {
  snapshot: BusinessSnapshot;
  trends: Record<string, MetricPoint[]>;
  /** Keyed by BusinessSnapshot field. A key is absent when there is no
   *  baseline — absence means "not known yet", not "no change". */
  changes: Record<string, MetricChange>;
  health: DashboardHealth;
  insights: DashboardInsight[];
  priorities: DashboardPriority[];
  meta: {
    /** Days of real history. Zero before the nightly job has run. Components
     *  use this to decide whether a sparkline would be honest. */
    historyDays: number;
    generatedAt: string;
  };
}

export const dashboardApi = {
  getMetrics: (days = 30) =>
    apiClient.get<ExecutiveSnapshot>(`/dashboard/metrics?days=${days}`),
};
