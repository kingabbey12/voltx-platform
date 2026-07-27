"use client";

import { Activity, AlertTriangle, BarChart3, CheckCircle2, DollarSign, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAiPerformance, useAiTasks, useAiActivity } from "@/hooks/use-ai-dashboard";
import { useKnowledgeStats, useKnowledgeHealth, useHealth, usePlatformHealth } from "@/hooks/use-ai-monitoring";
import { useAiCredentials } from "@/hooks/use-ai-settings";
import { formatRelativeTime } from "@/lib/format";

export default function AiMonitoringPage() {
  const queryClient = useQueryClient();

  const { data: perf, isLoading: perfLoading } = useAiPerformance(30);
  const { data: tasks, isLoading: tasksLoading } = useAiTasks();
  const { data: activity, isLoading: activityLoading } = useAiActivity();
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: platformHealth, isLoading: platformLoading } = usePlatformHealth();
  const { data: creds, isLoading: credsLoading } = useAiCredentials();
  const { data: knowledgeStats, isLoading: ksLoading } = useKnowledgeStats();
  const { data: knowledgeHealth, isLoading: khLoading } = useKnowledgeHealth();

  function handleRefresh() {
    queryClient.invalidateQueries({ queryKey: ["ai", "dashboard"] });
    queryClient.invalidateQueries({ queryKey: ["health"] });
    queryClient.invalidateQueries({ queryKey: ["platform"] });
    queryClient.invalidateQueries({ queryKey: ["knowledge"] });
    queryClient.invalidateQueries({ queryKey: ["ai", "credentials"] });
    queryClient.invalidateQueries({ queryKey: ["workflows"] });
  }

  const activeRequests = perf?.totalCallCount ?? 0;
  const activeRuns = tasks?.inProgressRuns?.length ?? 0;
  const pendingApprovals = tasks?.pendingApprovals?.length ?? 0;
  const totalTokens = perf?.totalTokens ?? 0;
  const totalCost = perf?.totalCostUsd ?? 0;
  const activeCreds = creds?.items.filter((c) => c.status === "ACTIVE").length ?? 0;
  const totalCreds = creds?.items.length ?? 0;
  const dbHealth = health?.dependencies.database.status;
  const redisHealth = health?.dependencies.redis?.status;
  const queueData = platformHealth?.queues;
  const totalQueueDepth = queueData?.reduce((sum, q) => sum + Object.values(q.depth).reduce((a, b) => a + b, 0), 0) ?? 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Monitoring</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time observability, health, and performance metrics.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">API Calls (30d)</CardTitle>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              activeRequests.toLocaleString()
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Active Runs</CardTitle>
            <BarChart3 className="h-3.5 w-3.5 text-blue-500" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {tasksLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              activeRuns
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pending Approvals</CardTitle>
            <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {tasksLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              pendingApprovals
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Queue Depth</CardTitle>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {platformLoading ? (
              <div className="h-7 w-12 animate-pulse rounded bg-secondary/60" />
            ) : (
              totalQueueDepth
            )}
          </CardContent>
        </Card>
      </div>

      {/* Performance metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tokens Used</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-20 animate-pulse rounded bg-secondary/60" />
            ) : (
              totalTokens.toLocaleString()
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Cost (30d)</CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              `$${totalCost.toFixed(2)}`
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg Embedding Latency
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {ksLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : knowledgeStats ? (
              `${knowledgeStats.embedding.averageLatencyMs.toFixed(0)}ms`
            ) : (
              "—"
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Retrieval Hit Rate
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {ksLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : knowledgeStats ? (
              `${(knowledgeStats.retrieval.hitRate * 100).toFixed(0)}%`
            ) : (
              "—"
            )}
          </CardContent>
        </Card>
      </div>

      {/* Health row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Database</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {health?.dependencies.database.latencyMs}ms
                    </span>
                    {dbHealth === "up" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                </div>
                {health?.dependencies.redis && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Redis</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {health.dependencies.redis.latencyMs}ms
                      </span>
                      {redisHealth === "up" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uptime</span>
                  <span className="font-medium tabular-nums">
                    {health ? `${Math.round(health.uptime / 60)}m` : "—"}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4" />
              Knowledge Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            {khLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status</span>
                  {knowledgeHealth?.healthy ? (
                    <Badge variant="success">Healthy</Badge>
                  ) : (
                    <Badge variant="destructive">Degraded</Badge>
                  )}
                </div>
                {knowledgeHealth?.reasons.map((r, i) => (
                  <p key={i} className="text-xs text-muted-foreground">{r}</p>
                ))}
                {ksLoading ? (
                  <div className="h-6 animate-pulse rounded bg-secondary/60" />
                ) : knowledgeStats ? (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Sources </span>
                      {knowledgeStats.indexSize.sourceCount}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Chunks </span>
                      {knowledgeStats.indexSize.chunkCount}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Providers + Queues */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <BarChart3 className="h-4 w-4" />
              Provider Credentials
            </CardTitle>
          </CardHeader>
          <CardContent>
            {credsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-2xl font-semibold tabular-nums">{activeCreds}</span>
                <span className="text-sm text-muted-foreground">/ {totalCreds} active</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Queue Depth
            </CardTitle>
          </CardHeader>
          <CardContent>
            {platformLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                ))}
              </div>
            ) : queueData && queueData.length > 0 ? (
              <div className="space-y-1.5">
                {queueData.slice(0, 5).map((q) => {
                  const total = Object.values(q.depth).reduce((a, b) => a + b, 0);
                  return (
                    <div key={q.queue} className="flex items-center justify-between text-sm">
                      <span className="text-xs text-muted-foreground truncate">{q.queue}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs tabular-nums">{total}</span>
                        {q.recentFailureCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1 py-0">
                            {q.recentFailureCount} failed
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No queue data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activityLoading && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          )}
          {!activityLoading && activity && activity.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activity.items.slice(0, 10).map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs font-medium">
                      Agent run
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "SUCCEEDED"
                            ? "success"
                            : run.status === "FAILED"
                              ? "destructive"
                              : "warning"
                        }
                        className="text-[10px]"
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatRelativeTime(run.startedAt ?? run.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!activityLoading && activity?.items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No recent activity.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
