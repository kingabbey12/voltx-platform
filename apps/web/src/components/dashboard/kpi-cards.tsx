"use client";

import { Bot, Building2, TrendingUp, Users } from "lucide-react";
import { KpiCard, type KpiCardProps } from "@/components/dashboard/kpi-card";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import type { ExecutiveSnapshot } from "@/lib/api/dashboard";
import { formatCount, formatCurrency } from "@/lib/format";

/**
 * The executive summary row.
 *
 * Reads one aggregate from /dashboard/metrics rather than issuing four list
 * requests and summing in the browser. Trends and changes come from real daily
 * snapshots — when none exist yet, they are simply absent and KpiCard omits
 * the sparkline rather than drawing an invented one.
 */

/** Series are only meaningful with enough points to show a shape. Two points
 *  is a line between two numbers, not a trend, so the sparkline stays hidden
 *  until there is genuinely something to see. */
const MIN_POINTS_FOR_SPARKLINE = 3;

function seriesFor(data: ExecutiveSnapshot | undefined, key: string): number[] | undefined {
  const points = data?.trends?.[key];
  if (!points || points.length < MIN_POINTS_FOR_SPARKLINE) return undefined;
  return points.map((point) => point.value);
}

function deltaFor(data: ExecutiveSnapshot | undefined, key: string) {
  const change = data?.changes?.[key];
  // A null percent means the baseline was zero — real movement, but no
  // meaningful percentage. Showing nothing beats showing "+100%".
  if (!change || change.percent === null) return undefined;
  return { change: change.percent, comparison: change.comparedTo };
}

export function KpiCards() {
  const { data, isLoading, isError } = useDashboardMetrics();
  const snapshot = data?.snapshot;

  /** Zero is "nothing here yet", not a value worth putting on a dashboard. */
  function stateFor(value: number | undefined): KpiCardProps["state"] {
    if (isLoading) return "loading";
    if (isError) return "error";
    if (!value) return "empty";
    return "ready";
  }

  const formatWholeCount = (current: number) => formatCount(Math.round(current));

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Pipeline value"
        icon={TrendingUp}
        accent="gold"
        state={stateFor(snapshot?.pipelineValue)}
        value={snapshot?.pipelineValue}
        format={formatCurrency}
        series={seriesFor(data, "pipelineValue")}
        delta={deltaFor(data, "pipelineValue")}
        action={{ label: "View pipeline", href: "/crm/opportunities" }}
        guidance={{
          explanation:
            "The total value of deals you could still win — the clearest signal of future revenue.",
          action: { label: "Create an opportunity", href: "/crm/opportunities" },
        }}
      />

      <KpiCard
        label="Companies"
        icon={Building2}
        accent="blue"
        state={stateFor(snapshot?.companies)}
        value={snapshot?.companies}
        format={formatWholeCount}
        series={seriesFor(data, "companies")}
        delta={deltaFor(data, "companies")}
        action={{ label: "View companies", href: "/crm/companies" }}
        guidance={{
          explanation:
            "The organisations you sell to. Contacts, deals and activity all hang off these.",
          action: { label: "Add your first company", href: "/crm/companies" },
        }}
      />

      <KpiCard
        label="Qualified leads"
        icon={Users}
        accent="orange"
        state={stateFor(snapshot?.qualifiedLeads)}
        value={snapshot?.qualifiedLeads}
        format={formatWholeCount}
        series={seriesFor(data, "qualifiedLeads")}
        delta={deltaFor(data, "qualifiedLeads")}
        action={{ label: "View leads", href: "/crm/leads" }}
        guidance={{
          explanation:
            "Leads worth your team's time, separated from the ones that are not. Qualify early to protect focus.",
          action: { label: "Add your first lead", href: "/crm/leads" },
        }}
      />

      <KpiCard
        label="Open opportunities"
        icon={Bot}
        accent="purple"
        state={stateFor(snapshot?.openOpportunities)}
        value={snapshot?.openOpportunities}
        format={formatWholeCount}
        series={seriesFor(data, "opportunities")}
        delta={deltaFor(data, "openOpportunities")}
        action={{ label: "View opportunities", href: "/crm/opportunities" }}
        guidance={{
          explanation:
            "Deals still in play. Watch this alongside pipeline value — many small deals and one large one are very different businesses.",
          action: { label: "Create an opportunity", href: "/crm/opportunities" },
        }}
      />
    </div>
  );
}
