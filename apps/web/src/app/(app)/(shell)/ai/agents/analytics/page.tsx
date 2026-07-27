"use client";

import { Bot, Activity, Timer, DollarSign, BarChart3, TrendingUp, Sparkles } from "lucide-react";
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
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgents } from "@/hooks/use-agents";
import { useAiPerformance } from "@/hooks/use-ai-dashboard";
import { cn } from "@/lib/utils";

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#3b82f6", "#8b5cf6", "#ec4899"];

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
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color ?? "bg-primary/10")}>
          <Icon className="h-4.5 w-4.5 text-primary" />
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

export default function AgentsAnalyticsOverviewPage() {
  const { data: agentsData, isLoading: agentsLoading } = useAgents({ limit: 100 });
  const { data: performance, isLoading: perfLoading } = useAiPerformance(30);

  const isLoading = agentsLoading || perfLoading;
  const agents = agentsData?.items ?? [];
  const agentCount = agents.length;
  const enabledCount = agents.filter((a) => a.enabled).length;

  const callData = (performance?.byAgent ?? []).map((entry) => ({
    name: entry.agentName ?? "Unknown",
    calls: entry.callCount,
    cost: entry.totalCostUsd,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Usage and performance metrics across all agents.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Bot} label="Total Agents" value={isLoading ? "\u2014" : agentCount} color="bg-blue-500/10" />
        <MetricCard icon={Sparkles} label="Enabled" value={isLoading ? "\u2014" : enabledCount} color="bg-emerald-500/10" />
        <MetricCard icon={Activity} label="Total Runs" value={performance?.totalCallCount ?? "\u2014"} color="bg-violet-500/10" />
        <MetricCard icon={DollarSign} label="Total Cost" value={performance ? `$${performance.totalCostUsd.toFixed(2)}` : "\u2014"} secondary="Last 30 days" color="bg-rose-500/10" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Calls per agent */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Calls per Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-56 animate-pulse rounded-lg bg-secondary/60" />
            ) : callData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={callData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="calls" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Cost distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Cost Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-56 animate-pulse rounded-lg bg-secondary/60" />
            ) : callData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={callData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    dataKey="cost"
                    nameKey="name"
                    labelLine={false}
                  >
                    {callData.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`$${Number(value).toFixed(4)}`, "Cost"]}
                    contentStyle={{
                      background: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-xs text-muted-foreground">No data yet.</p>
            )}
          </CardContent>
        </Card>

        {/* Token usage summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              Token Usage by Agent
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-lg bg-secondary/60" />
            ) : performance?.byAgent && performance.byAgent.length > 0 ? (
              <div className="space-y-3">
                {performance.byAgent.slice(0, 6).map((entry) => (
                  <div key={entry.agentId ?? "unknown"} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium">{entry.agentName ?? "Unknown"}</span>
                      <span className="text-muted-foreground">{entry.totalTokens.toLocaleString()} tokens</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{
                          width: `${Math.min(
                            (entry.totalTokens / Math.max(...performance.byAgent.map((e) => e.totalTokens))) * 100,
                            100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No token usage data available.</p>
            )}
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Timer className="h-4 w-4" />
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="h-40 animate-pulse rounded-lg bg-secondary/60" />
            ) : performance ? (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Lookback Period</span>
                  <span className="font-medium">{performance.lookbackDays} days</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Calls</span>
                  <span className="font-medium">{performance.totalCallCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Tokens</span>
                  <span className="font-medium">{performance.totalTokens.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Total Cost</span>
                  <span className="font-medium">${performance.totalCostUsd.toFixed(4)}</span>
                </div>
              </>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No performance data available.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
