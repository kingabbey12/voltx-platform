"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  History,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { LoadingScreen } from "@/components/loading-screen";
import {
  useCancelRun,
  usePauseRun,
  useResumeRun,
  useRetryRun,
  useWorkflow,
  useWorkflowMetrics,
  useWorkflowRunCheckpoints,
  useWorkflowRunLogs,
  useWorkflowRuns,
} from "@/hooks/use-workflows";
import { WorkflowRunStatusBadge } from "@/components/ai-workflows/status-badges";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import type { WorkflowRunStatus } from "@/lib/api/workflows";

const RUN_ACTIONABLE_STATUSES: WorkflowRunStatus[] = [
  "RUNNING",
  "PAUSED",
  "FAILED",
  "WAITING_APPROVAL",
];

export default function WorkflowRunsPage({
  params,
}: {
  params: Promise<{ workflowId: string }>;
}) {
  const { workflowId: id } = use(params);
  const router = useRouter();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: workflow, isLoading } = useWorkflow(id);
  const { data: runs, isLoading: runsLoading } = useWorkflowRuns(id);
  const { data: metrics } = useWorkflowMetrics(id);
  const { data: runLogs, isLoading: logsLoading } = useWorkflowRunLogs(
    selectedRunId ?? "",
  );
  const { data: runCheckpoints, isLoading: checkpointsLoading } =
    useWorkflowRunCheckpoints(selectedRunId ?? "");

  const pauseRun = usePauseRun();
  const resumeRun = useResumeRun();
  const cancelRun = useCancelRun();
  const retryRun = useRetryRun();

  async function handleRunAction(
    action: typeof pauseRun,
    runId: string,
    successMessage: string,
  ) {
    try {
      await action.mutateAsync(runId);
      toast.success(successMessage);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const selectedRun = runs?.items.find((run) => run.id === selectedRunId);

  if (isLoading) return <LoadingScreen />;
  if (!workflow) return null;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(`/ai/workflows/${id}`)}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        {workflow.name}
      </Button>

      <PageHeader
        title="Run history"
        description={`${metrics?.totalRuns ?? 0} total runs · ${metrics ? `${Math.round(metrics.successRate * 100)}%` : "—"} success rate`}
        className="mb-6"
      />

      {/* Analytics summary */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total runs
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {metrics?.totalRuns ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Succeeded
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums text-emerald-500">
            {metrics?.succeededRuns ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Failed
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums text-red-500">
            {metrics?.failedRuns ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Avg duration
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {metrics && Number(metrics.averageExecutionTimeMs) > 0
              ? `${Math.round(Number(metrics.averageExecutionTimeMs) / 1000)}s`
              : "—"}
          </CardContent>
        </Card>
      </div>

      {/* Runs table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">All runs</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {runsLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-10 animate-pulse rounded-lg bg-secondary/60"
                />
              ))}
            </div>
          )}

          {!runsLoading && runs?.items.length === 0 && (
            <EmptyState
              icon={History}
              title="No runs yet"
              description="Trigger a run from the workflow detail page."
            />
          )}

          {!runsLoading && runs && runs.items.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Steps</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead className="w-28">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.items.map((run) => {
                  const stepRunsCount = 0;
                  return (
                    <TableRow
                      key={run.id}
                      className="cursor-pointer"
                      onClick={() =>
                        setSelectedRunId(
                          run.id === selectedRunId ? null : run.id,
                        )
                      }
                      data-state={
                        run.id === selectedRunId ? "selected" : undefined
                      }
                    >
                      <TableCell>
                        <WorkflowRunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.triggerType}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-muted-foreground">
                        {run.durationMs != null
                          ? `${Math.round(run.durationMs / 1000)}s`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {stepRunsCount || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.startedAt
                          ? formatRelativeTime(run.startedAt)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {run.completedAt
                          ? formatRelativeTime(run.completedAt)
                          : "—"}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {RUN_ACTIONABLE_STATUSES.includes(run.status) && (
                          <div className="flex gap-1">
                            {run.status === "RUNNING" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                isLoading={pauseRun.isPending}
                                onClick={() =>
                                  handleRunAction(
                                    pauseRun,
                                    run.id,
                                    "Run paused",
                                  )
                                }
                              >
                                <Pause className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {run.status === "PAUSED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                isLoading={resumeRun.isPending}
                                onClick={() =>
                                  handleRunAction(
                                    resumeRun,
                                    run.id,
                                    "Run resumed",
                                  )
                                }
                              >
                                <Play className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {run.status === "FAILED" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                isLoading={retryRun.isPending}
                                onClick={() =>
                                  handleRunAction(
                                    retryRun,
                                    run.id,
                                    "Run retried",
                                  )
                                }
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {(run.status === "RUNNING" ||
                              run.status === "PAUSED") && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 w-7 p-0"
                                isLoading={cancelRun.isPending}
                                onClick={() =>
                                  handleRunAction(
                                    cancelRun,
                                    run.id,
                                    "Run cancelled",
                                  )
                                }
                              >
                                <Square className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Run detail panel */}
      {selectedRun && (
        <div className="mt-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">
                  Run{" "}
                  <span className="font-mono text-xs">
                    {selectedRun.id.slice(0, 12)}…
                  </span>
                </CardTitle>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {selectedRun.error && (
                    <span className="text-red-500 max-w-md truncate" title={selectedRun.error}>
                      Error: {selectedRun.error}
                    </span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <WorkflowRunStatusBadge status={selectedRun.status} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Trigger</p>
                  <p className="text-sm font-medium">
                    {selectedRun.triggerType}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duration</p>
                  <p className="text-sm font-medium tabular-nums">
                    {selectedRun.durationMs != null
                      ? `${(selectedRun.durationMs / 1000).toFixed(1)}s`
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Started</p>
                  <p className="text-sm font-medium">
                    {selectedRun.startedAt
                      ? formatRelativeTime(selectedRun.startedAt)
                      : "—"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Execution logs</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {logsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!logsLoading && !runLogs?.items.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  No log entries for this run.
                </p>
              )}
              {!logsLoading && !!runLogs?.items.length && (
                <div className="max-h-96 space-y-1 overflow-y-auto font-mono text-xs">
                  {runLogs.items.map((log) => (
                    <div
                      key={log.id}
                      className="flex gap-2 border-b border-border/50 py-1.5"
                    >
                      <span className="shrink-0 text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleTimeString()}
                      </span>
                      <Badge
                        variant={
                          log.level === "ERROR"
                            ? "destructive"
                            : log.level === "WARN"
                              ? "warning"
                              : "secondary"
                        }
                        className="shrink-0 text-[10px] px-1.5 py-0 h-4"
                      >
                        {log.level}
                      </Badge>
                      <span className="text-foreground">{log.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Checkpoints</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {checkpointsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
              {!checkpointsLoading && !runCheckpoints?.length && (
                <p className="py-4 text-sm text-muted-foreground">
                  No checkpoints recorded.
                </p>
              )}
              {!checkpointsLoading && !!runCheckpoints?.length && (
                <div className="space-y-2">
                  {runCheckpoints.map((checkpoint, i) => (
                    <div
                      key={checkpoint.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-[11px] font-medium">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-medium">
                          Step:{" "}
                          <span className="font-mono">{checkpoint.stepId}</span>
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatRelativeTime(checkpoint.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
