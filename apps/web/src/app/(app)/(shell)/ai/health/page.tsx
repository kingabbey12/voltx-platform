"use client";

import { AlertTriangle, CheckCircle2, Clock, Activity, BarChart3 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useHealth, usePlatformHealth, useKnowledgeHealth, useKnowledgeStats, useBackgroundJobFailures } from "@/hooks/use-ai-monitoring";
import { formatRelativeTime } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function AiHealthPage() {
  const { data: health, isLoading: healthLoading } = useHealth();
  const { data: platform } = usePlatformHealth();
  const { data: kHealth, isLoading: khLoading } = useKnowledgeHealth();
  const { data: kStats, isLoading: ksLoading } = useKnowledgeStats();
  const { data: deadLetters, isLoading: dlLoading } = useBackgroundJobFailures();

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Health</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          System health, knowledge health, and background job failures.
        </p>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Activity className="h-4 w-4" />
            System Health
          </CardTitle>
          {healthLoading ? (
            <div className="h-5 w-16 animate-pulse rounded bg-secondary/60" />
          ) : (
            <Badge variant={health?.status === "ok" ? "success" : "destructive"}>
              {health?.status === "ok" ? "Healthy" : "Unhealthy"}
            </Badge>
          )}
        </CardHeader>
        <CardContent>
          {healthLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          ) : health ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Uptime</span>
                <span className="font-medium tabular-nums">
                  {Math.floor(health.uptime / 86400)}d {Math.floor((health.uptime % 86400) / 3600)}h
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Checked</span>
                <span className="text-xs text-muted-foreground">
                  {formatRelativeTime(health.timestamp)}
                </span>
              </div>
              <div className="border-t pt-3 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Database</span>
                    {health.dependencies.database.status === "up" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-red-500" />
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {health.dependencies.database.latencyMs}ms
                  </span>
                </div>
                {health.dependencies.redis && (
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Redis</span>
                      {health.dependencies.redis.status === "up" ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 text-red-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {health.dependencies.redis.latencyMs}ms
                    </span>
                  </div>
                )}
              </div>

              {/* Dependencies from platform health */}
              {platform && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Queue / Comms</p>
                  {platform.queues && platform.queues.length > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Active queues</span>
                      <span className="tabular-nums">{platform.queues.length}</span>
                    </div>
                  )}
                  {platform.commsDelivery && (
                    <>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Total messages</span>
                        <span className="tabular-nums">
                          {platform.commsDelivery.totalMessages.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Failure rate</span>
                        <span className="tabular-nums">
                          {(platform.commsDelivery.failureRate * 100).toFixed(2)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No health data.</p>
          )}
        </CardContent>
      </Card>

      {/* Knowledge Health + Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Knowledge Health
            </CardTitle>
            {khLoading ? (
              <div className="h-5 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              <Badge variant={kHealth?.healthy ? "success" : "destructive"}>
                {kHealth?.healthy ? "Healthy" : "Degraded"}
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {khLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {kHealth?.reasons && kHealth.reasons.length > 0 ? (
                  kHealth.reasons.map((r, i) => (
                    <p key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                      <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0 text-amber-500" />
                      {r}
                    </p>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">All systems operational.</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <BarChart3 className="h-4 w-4" />
              Index Size
            </CardTitle>
          </CardHeader>
          <CardContent>
            {ksLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-6 animate-pulse rounded bg-secondary/60" />
                ))}
              </div>
            ) : kStats ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Sources</span>
                  <span className="tabular-nums">{kStats.indexSize.sourceCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="tabular-nums">{kStats.indexSize.documentCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Chunks</span>
                  <span className="tabular-nums">{kStats.indexSize.chunkCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Entities</span>
                  <span className="tabular-nums">{kStats.indexSize.entityCount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Relationships</span>
                  <span className="tabular-nums">{kStats.indexSize.relationshipCount.toLocaleString()}</span>
                </div>
                <div className="border-t pt-2 mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Embed calls</span>
                    <span className="tabular-nums">{kStats.embedding.callCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Avg embed latency</span>
                    <span className="tabular-nums">{kStats.embedding.averageLatencyMs.toFixed(0)}ms</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Searches</span>
                    <span className="tabular-nums">{kStats.retrieval.searchCount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Hit rate</span>
                    <span className="tabular-nums">
                      {(kStats.retrieval.hitRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Cache hit rate</span>
                    <span className="tabular-nums">
                      {(kStats.retrieval.cacheHitRate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No knowledge stats.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dead Letter Jobs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4" />
            Failed Background Jobs
            {!dlLoading && deadLetters && deadLetters.items.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-[10px]">
                {deadLetters.items.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {dlLoading && (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          )}
          {!dlLoading && deadLetters && deadLetters.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Job</TableHead>
                  <TableHead className="text-xs">Queue</TableHead>
                  <TableHead className="text-xs">Attempts</TableHead>
                  <TableHead className="text-xs">Error</TableHead>
                  <TableHead className="text-xs">Failed At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deadLetters.items.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="text-xs font-medium truncate max-w-[140px]" title={job.jobName}>
                      {job.jobName}
                    </TableCell>
                    <TableCell className="text-xs">{job.queueName}</TableCell>
                    <TableCell className="text-xs tabular-nums">{job.attemptsMade}</TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate" title={job.failureReason}>
                      {job.failureReason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(job.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!dlLoading && (!deadLetters || deadLetters.items.length === 0) && (
            <p className="p-4 text-sm text-muted-foreground text-center">
              <CheckCircle2 className="h-4 w-4 inline mr-1 text-emerald-500" />
              No failed background jobs.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
