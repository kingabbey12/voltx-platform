"use client";

import { useState } from "react";
import {
  MessagesSquare,
  Workflow,
  Search,
  Bot,
  Database,
  FileText,
  Activity,
  BarChart3,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiPerformance, useAiActivity } from "@/hooks/use-ai-dashboard";
import { useKnowledgeStats } from "@/hooks/use-ai-monitoring";
import { useWorkflows } from "@/hooks/use-workflows";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type Period = 7 | 30 | 90;
const PERIOD_OPTIONS: { label: string; value: Period }[] = [
  { label: "7 days", value: 7 },
  { label: "30 days", value: 30 },
  { label: "90 days", value: 90 },
];

export default function AiUsagePage() {
  const [period, setPeriod] = useState<Period>(30);

  const { data: perf, isLoading: perfLoading } = useAiPerformance(period);
  const { data: activity, isLoading: activityLoading } = useAiActivity({ page: 1, limit: 20 });
  const { data: kStats, isLoading: ksLoading } = useKnowledgeStats();
  const { data: wf, isLoading: wfLoading } = useWorkflows();

  const totalConversations = activity?.items?.length
    ? new Set(activity.items.map((r) => r.conversationId)).size
    : 0;
  const agentRuns = activity?.items?.length ?? 0;
  const workflowRuns = wf?.items?.length ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Usage</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Usage metrics across AI agents, workflows, and knowledge.
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-lg border p-0.5">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={cn(
                "px-3 py-1 text-xs rounded-md transition-colors",
                period === opt.value
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">API Calls</CardTitle>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCount(perf?.totalCallCount ?? 0)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tokens</CardTitle>
            <FileText className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCount(perf?.totalTokens ?? 0)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cost (USD)</CardTitle>
            <BarChart3 className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              `$${(perf?.totalCostUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-xs font-medium text-muted-foreground">Conversations</CardTitle>
            <MessagesSquare className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {activityLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              totalConversations
            )}
          </CardContent>
        </Card>
      </div>

      {/* Detailed metrics grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Bot className="h-3 w-3" />
              Agent Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold tabular-nums">
            {activityLoading ? (
              <div className="h-6 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCount(agentRuns)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Workflow className="h-3 w-3" />
              Workflow Runs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold tabular-nums">
            {wfLoading ? (
              <div className="h-6 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCount(workflowRuns)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Search className="h-3 w-3" />
              Searches
            </CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold tabular-nums">
            {ksLoading ? (
              <div className="h-6 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCount(kStats?.retrieval.searchCount ?? 0)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Database className="h-3 w-3" />
              Embeddings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-base font-semibold tabular-nums">
            {ksLoading ? (
              <div className="h-6 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCount(kStats?.embedding.callCount ?? 0)
            )}
          </CardContent>
        </Card>
      </div>

      {/* Trend bar charts per metric */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Per-Agent Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          {perfLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          ) : perf?.byAgent && perf.byAgent.length > 0 ? (
            <div className="space-y-3">
              {perf.byAgent.slice(0, 10).map((entry) => {
                const maxCalls = Math.max(...perf.byAgent.map((a) => a.callCount), 1);
                const pct = (entry.callCount / maxCalls) * 100;
                return (
                  <div key={entry.agentId ?? "unknown"} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">
                        {entry.agentName ?? entry.agentId ?? "Unknown"}
                      </span>
                      <div className="flex items-center gap-3 tabular-nums text-muted-foreground">
                        <span>{entry.callCount.toLocaleString()} calls</span>
                        <span>{entry.totalTokens.toLocaleString()} tokens</span>
                        <span className="font-medium text-foreground">
                          ${entry.totalCostUsd.toFixed(2)}
                        </span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary/60 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No agent usage data for this period.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Recent activity mini */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {activityLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          )}
          {!activityLoading && activity && activity.items.length > 0 && (
            <div className="space-y-1.5">
              {activity.items.slice(0, 10).map((run) => (
                <div
                  key={run.id}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                      {run.id.slice(0, 8)}...
                    </span>
                    <Badge
                      variant={
                        run.status === "SUCCEEDED"
                          ? "success"
                          : run.status === "FAILED"
                            ? "destructive"
                            : "warning"
                      }
                      className="text-[9px] px-1 py-0"
                    >
                      {run.status.replace(/_/g, " ")}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground shrink-0">
                    {formatRelativeTime(run.startedAt ?? run.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!activityLoading && !activity?.items.length && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No recent activity.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
