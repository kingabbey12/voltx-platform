"use client";

import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  Activity,
  CheckCircle2,
  Timer,
  DollarSign,
  BarChart3,
  Wrench,
  CalendarClock,
  TriangleAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent, useAgentStats } from "@/hooks/use-agents";
import { useAiPerformance } from "@/hooks/use-ai-dashboard";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function MetricCard({
  icon: Icon,
  label,
  value,
  secondary,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  secondary?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color ?? "bg-primary/10")}>
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
        </div>
        <div className="mt-3">
          <p className="text-2xl font-semibold tracking-tight">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          {secondary && <p className="mt-0.5 text-[11px] text-muted-foreground/60">{secondary}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function AgentAnalyticsPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;

  const { data: agent, isLoading: agentLoading, isError: agentError, refetch: refetchAgent } = useAgent(agentId);
  const { data: stats, isLoading: statsLoading } = useAgentStats(agentId);
  const { data: performance, isLoading: perfLoading } = useAiPerformance(30);

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (agentError || !agent) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <TriangleAlert className="h-12 w-12 text-warning" aria-hidden />
        <p className="text-sm font-medium text-muted-foreground">{agentError ? "Agent analytics could not be loaded" : "Agent not found"}</p>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">{agentError ? "Your agent is unchanged. Retry to load metrics that are currently available." : "The requested agent is unavailable in this workspace."}</p>
        <div className="flex gap-2"><Button variant="outline" size="sm" onClick={() => router.push("/ai/agents")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Button>{agentError && <Button size="sm" onClick={() => refetchAgent()}>Try again</Button>}</div>
      </div>
    );
  }

  const successRate = stats ? (stats.succeededRunCount / Math.max(stats.totalRunCount, 1)) * 100 : 0;
  const agentPerformance = performance?.byAgent.find((entry) => entry.agentId === agentId);
  const failedRunCount = stats ? Math.max(stats.totalRunCount - stats.succeededRunCount, 0) : 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Performance metrics for <strong>{agent.name}</strong>
          </p>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Activity}
          label="Total Runs"
          value={stats?.totalRunCount ?? "\u2014"}
          color="bg-blue-500/10"
        />
        <MetricCard
          icon={CheckCircle2}
          label="Success Rate"
          value={stats ? `${successRate.toFixed(0)}%` : "\u2014"}
          secondary={`${stats?.succeededRunCount ?? 0} succeeded`}
          color="bg-emerald-500/10"
        />
        <MetricCard
          icon={Wrench}
          label="Available Tools"
          value={stats?.toolCount ?? "\u2014"}
          color="bg-amber-500/10"
        />
        <MetricCard
          icon={CalendarClock}
          label="Last Run"
          value={stats?.lastRunAt ? formatRelativeTime(stats.lastRunAt) : "\u2014"}
          secondary="Reported by agent statistics"
          color="bg-rose-500/10"
        />
      </div>

      {/* Only the aggregate performance endpoint is available; no time-series is inferred. */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Run status summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-48 animate-pulse rounded-lg bg-secondary/60" />
            ) : stats && stats.totalRunCount > 0 ? (
              <dl className="grid min-h-48 grid-cols-2 gap-3" aria-label="Run status summary"><div className="rounded-xl border border-success/20 bg-success/5 p-4"><dt className="text-xs text-muted-foreground">Succeeded</dt><dd className="mt-2 text-3xl font-semibold tabular-nums text-success">{stats.succeededRunCount}</dd></div><div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4"><dt className="text-xs text-muted-foreground">Not succeeded</dt><dd className="mt-2 text-3xl font-semibold tabular-nums text-destructive">{failedRunCount}</dd></div><div className="col-span-2 text-xs leading-relaxed text-muted-foreground">Success rate: {successRate.toFixed(0)}% across {stats.totalRunCount} recorded runs.</div></dl>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">No run data yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              30-day aggregate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {perfLoading ? (
              <div className="h-36 animate-pulse rounded-lg bg-secondary/60" />
            ) : agentPerformance ? (
              <dl className="grid gap-3 xl:grid-cols-3"><div><dt className="text-xs text-muted-foreground">Calls</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{agentPerformance.callCount}</dd></div><div><dt className="text-xs text-muted-foreground">Tokens</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{agentPerformance.totalTokens.toLocaleString()}</dd></div><div><dt className="text-xs text-muted-foreground">Cost</dt><dd className="mt-1 text-xl font-semibold tabular-nums">${agentPerformance.totalCostUsd.toFixed(4)}</dd></div></dl>
            ) : (
              <UnavailableAnalytics />
            )}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle className="flex items-center gap-2 text-sm font-medium"><Timer className="h-4 w-4" />Historical trends</CardTitle></CardHeader><CardContent><UnavailableAnalytics /></CardContent></Card>
      </div>
    </div>
  );
}

function UnavailableAnalytics() {
  return <div className="min-h-36 rounded-xl border border-dashed border-border/70 bg-muted/20 p-4"><p className="text-sm font-medium">Historical analytics unavailable</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">The current agent APIs expose aggregate counts and 30-day totals, not daily cost, duration, or time-series performance. Voltx will not infer those metrics.</p></div>;
}
