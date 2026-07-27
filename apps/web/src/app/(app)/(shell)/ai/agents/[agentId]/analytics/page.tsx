"use client";

import { useParams, useRouter } from "next/navigation";
import {
  Bot,
  ArrowLeft,
  Loader2,
  Activity,
  CheckCircle2,
  Timer,
  DollarSign,
  BarChart3,
  TrendingUp,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent, useAgentStats } from "@/hooks/use-agents";
import { useAiPerformance } from "@/hooks/use-ai-dashboard";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6"];

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

  const { data: agent, isLoading: agentLoading } = useAgent(agentId);
  const { data: stats, isLoading: statsLoading } = useAgentStats(agentId);
  const { data: performance, isLoading: perfLoading } = useAiPerformance(30);

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Agent not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/ai/agents")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    );
  }

  const successRate = stats ? (stats.succeededRunCount / Math.max(stats.totalRunCount, 1)) * 100 : 0;

  // Sample chart data - in production this would come from a dedicated analytics API
  const runStatusData = [
    { name: "Succeeded", value: stats?.succeededRunCount ?? 0 },
    { name: "Failed", value: (stats?.totalRunCount ?? 0) - (stats?.succeededRunCount ?? 0) },
  ];

  const costData = [
    { day: "Mon", cost: 0.15 },
    { day: "Tue", cost: 0.22 },
    { day: "Wed", cost: 0.18 },
    { day: "Thu", cost: 0.35 },
    { day: "Fri", cost: 0.28 },
    { day: "Sat", cost: 0.12 },
    { day: "Sun", cost: 0.08 },
  ];

  const durationData = [
    { day: "Mon", avg: 4200 },
    { day: "Tue", avg: 3800 },
    { day: "Wed", avg: 5100 },
    { day: "Thu", avg: 4600 },
    { day: "Fri", avg: 3900 },
    { day: "Sat", avg: 2800 },
    { day: "Sun", avg: 2200 },
  ];

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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          icon={Timer}
          label="Avg Duration"
          value={performance ? `${(performance.totalCallCount > 0 ? (performance.totalTokens / performance.totalCallCount) / 100 : 0).toFixed(1)}s` : "\u2014"}
          color="bg-amber-500/10"
        />
        <MetricCard
          icon={DollarSign}
          label="Total Cost"
          value={performance ? `$${performance.totalCostUsd.toFixed(2)}` : "\u2014"}
          secondary="Last 30 days"
          color="bg-rose-500/10"
        />
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Run Status Pie */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Run Status Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-48 animate-pulse rounded-lg bg-secondary/60" />
            ) : stats && stats.totalRunCount > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={runStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {runStatusData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend
                    verticalAlign="bottom"
                    height={28}
                    formatter={(value) => <span className="text-xs text-muted-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">No run data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Daily Cost */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Daily Cost (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Avg Duration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Timer className="h-4 w-4" />
              Avg Duration (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={durationData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="avg"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: "hsl(var(--primary))", r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Agent Performance Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Performance Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {perfLoading ? (
              <div className="h-36 animate-pulse rounded-lg bg-secondary/60" />
            ) : performance?.byAgent && performance.byAgent.length > 0 ? (
              <div className="space-y-3">
                {performance.byAgent.slice(0, 5).map((entry) => (
                  <div key={entry.agentId ?? "unknown"} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{entry.agentName ?? "Unknown Agent"}</span>
                      <span className="text-muted-foreground">{entry.callCount} calls</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{entry.totalTokens.toLocaleString()} tokens</span>
                      <span>${entry.totalCostUsd.toFixed(4)}</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${Math.min((entry.callCount / Math.max(...performance.byAgent.map((e) => e.callCount))) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No performance data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
