"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Archive,
  ArrowLeft,
  BarChart3,
  DollarSign,
  History,
  Play,
  Rocket,
  Timer,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingScreen } from "@/components/loading-screen";
import {
  useArchiveWorkflow,
  useCancelRun,
  usePauseRun,
  usePublishWorkflow,
  useRetryRun,
  useRunWorkflow,
  useWorkflow,
  useWorkflowMetrics,
  useWorkflowRunCheckpoints,
  useWorkflowRunLogs,
  useWorkflowRuns,
  useWorkflowVersions,
} from "@/hooks/use-workflows";
import { WorkflowStatusBadge, WorkflowRunStatusBadge } from "@/components/ai-workflows/status-badges";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import type { WorkflowRunStatus } from "@/lib/api/workflows";

const RUN_ACTIONABLE_STATUSES: WorkflowRunStatus[] = ["RUNNING", "PAUSED", "FAILED", "WAITING_APPROVAL"];

export default function WorkflowDetailPage({ params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId: id } = use(params);
  const router = useRouter();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const { data: workflow, isLoading } = useWorkflow(id);
  const { data: versions } = useWorkflowVersions(id);
  const { data: runs } = useWorkflowRuns(id);
  const { data: metrics } = useWorkflowMetrics(id);
  const { data: runLogs } = useWorkflowRunLogs(selectedRunId ?? "");
  const { data: runCheckpoints } = useWorkflowRunCheckpoints(selectedRunId ?? "");

  const publishWorkflow = usePublishWorkflow();
  const archiveWorkflow = useArchiveWorkflow();
  const runWorkflow = useRunWorkflow(id);
  const pauseRun = usePauseRun();
  const cancelRun = useCancelRun();
  const retryRun = useRetryRun();

  async function handlePublish() {
    try {
      await publishWorkflow.mutateAsync(id);
      toast.success("Workflow published");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleArchive() {
    try {
      await archiveWorkflow.mutateAsync(id);
      toast.success("Workflow archived");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleRun() {
    try {
      await runWorkflow.mutateAsync(undefined);
      toast.success("Workflow run queued");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

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

  if (isLoading) return <LoadingScreen />;
  if (!workflow) return null;

  const latestVersion = versions && versions.length > 0
    ? versions[versions.length - 1]
    : null;
  const stepCount = latestVersion?.definition.steps.length ?? 0;
  const selectedRun = runs?.items.find((run) => run.id === selectedRunId);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/ai/workflows")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Workflows
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{workflow.name}</h1>
            <WorkflowStatusBadge status={workflow.status} />
          </div>
          {workflow.description && (
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {stepCount} step{stepCount === 1 ? "" : "s"}
            {workflow.publishedVersion != null &&
              ` · v${workflow.publishedVersion} published`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {workflow.status === "DRAFT" && (
            <Button
              variant="outline"
              onClick={handlePublish}
              isLoading={publishWorkflow.isPending}
            >
              <Rocket className="h-4 w-4" />
              Publish
            </Button>
          )}
          {workflow.status === "PUBLISHED" && (
            <Button
              variant="outline"
              onClick={handleArchive}
              isLoading={archiveWorkflow.isPending}
            >
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/ai/workflows/${id}/edit`)}
          >
            <Wand2 className="h-4 w-4" />
            Edit
          </Button>
          <Button
            onClick={handleRun}
            isLoading={runWorkflow.isPending}
            disabled={workflow.status === "ARCHIVED"}
          >
            <Play className="h-4 w-4" />
            Run now
          </Button>
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total runs</CardTitle>
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {metrics?.totalRuns ?? "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Success rate</CardTitle>
            <BarChart3 className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {metrics ? `${Math.round(metrics.successRate * 100)}%` : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg duration</CardTitle>
            <Timer className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {metrics && Number(metrics.averageExecutionTimeMs) > 0
              ? `${Math.round(Number(metrics.averageExecutionTimeMs) / 1000)}s`
              : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total cost</CardTitle>
            <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-xl font-semibold tabular-nums">
            {metrics && metrics.totalCostUsd > 0
              ? `$${metrics.totalCostUsd.toFixed(metrics.totalCostUsd < 1 ? 4 : 2)}`
              : "—"}
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="runs" className="mt-6">
        <TabsList>
          <TabsTrigger value="runs">Run history</TabsTrigger>
          <TabsTrigger value="metrics">Analytics</TabsTrigger>
          <TabsTrigger value="versions">Versions</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Run history</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/ai/workflows/${id}/runs`)}
              >
                <History className="h-3.5 w-3.5" />
                View all
              </Button>
            </CardHeader>
            <CardContent className="pt-0">
              {!runs?.items.length && (
                <EmptyState
                  icon={History}
                  title="No runs yet"
                  description="Trigger a run to see execution history here."
                />
              )}
              {runs && runs.items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="w-24">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.items.slice(0, 10).map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer"
                        onClick={() =>
                          setSelectedRunId(run.id === selectedRunId ? null : run.id)
                        }
                        data-state={run.id === selectedRunId ? "selected" : undefined}
                      >
                        <TableCell>
                          <WorkflowRunStatusBadge status={run.status} />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {run.triggerType}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums text-muted-foreground">
                          {run.durationMs != null ? `${Math.round(run.durationMs / 1000)}s` : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {run.startedAt ? formatRelativeTime(run.startedAt) : "—"}
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
                                    handleRunAction(pauseRun, run.id, "Run paused")
                                  }
                                >
                                  <Timer className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {run.status === "FAILED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  isLoading={retryRun.isPending}
                                  onClick={() =>
                                    handleRunAction(retryRun, run.id, "Run retried")
                                  }
                                >
                                  <Rocket className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {(run.status === "RUNNING" || run.status === "PAUSED") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 p-0"
                                  isLoading={cancelRun.isPending}
                                  onClick={() =>
                                    handleRunAction(cancelRun, run.id, "Run cancelled")
                                  }
                                >
                                  <Archive className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {selectedRun && (
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Run detail —{" "}
                  <span className="font-mono text-xs">{selectedRun.id.slice(0, 8)}…</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Tabs defaultValue="logs">
                  <TabsList>
                    <TabsTrigger value="logs">Logs</TabsTrigger>
                    <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
                  </TabsList>
                  <TabsContent value="logs">
                    {!runLogs?.items.length && (
                      <p className="py-4 text-sm text-muted-foreground">No log entries yet.</p>
                    )}
                    {!!runLogs?.items.length && (
                      <div className="max-h-80 space-y-1 overflow-y-auto font-mono text-xs">
                        {runLogs.items.map((log) => (
                          <div
                            key={log.id}
                            className="flex gap-2 border-b border-border/50 py-1"
                          >
                            <span className="shrink-0 text-muted-foreground">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                            <span
                              className={`shrink-0 font-medium ${
                                log.level === "ERROR"
                                  ? "text-red-500"
                                  : log.level === "WARN"
                                    ? "text-amber-500"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {log.level}
                            </span>
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="checkpoints">
                    {!runCheckpoints?.length && (
                      <p className="py-4 text-sm text-muted-foreground">
                        No checkpoints recorded yet.
                      </p>
                    )}
                    {!!runCheckpoints?.length && (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Step</TableHead>
                            <TableHead>Created</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {runCheckpoints.map((checkpoint) => (
                            <TableRow key={checkpoint.id}>
                              <TableCell className="text-xs text-muted-foreground font-mono">
                                {checkpoint.stepId}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatRelativeTime(checkpoint.createdAt)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="metrics">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total runs
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">
                {metrics?.totalRuns ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Succeeded
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums text-emerald-500">
                {metrics?.succeededRuns ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Failed
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums text-red-500">
                {metrics?.failedRuns ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Success rate
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">
                {metrics ? `${Math.round(metrics.successRate * 100)}%` : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Avg duration
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">
                {metrics && Number(metrics.averageExecutionTimeMs) > 0
                  ? `${Math.round(Number(metrics.averageExecutionTimeMs) / 1000)}s`
                  : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Avg queue time
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">
                {metrics && Number(metrics.averageQueueTimeMs) > 0
                  ? `${Math.round(Number(metrics.averageQueueTimeMs) / 1000)}s`
                  : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total cost
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">
                {metrics && metrics.totalCostUsd > 0
                  ? `$${metrics.totalCostUsd.toFixed(metrics.totalCostUsd < 1 ? 4 : 2)}`
                  : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                  Total tokens
                </CardTitle>
              </CardHeader>
              <CardContent className="text-lg font-semibold tabular-nums">
                {metrics?.totalTokens
                  ? (metrics.totalTokens).toLocaleString()
                  : "—"}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="versions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Version history</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {!versions?.length && (
                <p className="py-4 text-sm text-muted-foreground">No versions yet.</p>
              )}
              {!!versions?.length && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Version</TableHead>
                      <TableHead>Steps</TableHead>
                      <TableHead>Created by</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {versions.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-mono text-xs">v{v.version}</TableCell>
                        <TableCell className="text-xs">{v.definition.steps.length}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {v.createdBy.slice(0, 8)}…
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatRelativeTime(v.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
