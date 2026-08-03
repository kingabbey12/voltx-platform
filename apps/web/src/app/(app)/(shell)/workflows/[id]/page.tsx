"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Archive,
  CheckCircle2,
  Circle,
  CircleAlert,
  Clock3,
  History,
  ListChecks,
  Pause,
  Play,
  RotateCcw,
  Rocket,
  Square,
  Wand2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CopilotButton } from "@/components/ai/copilot-button";
import {
  useArchiveWorkflow,
  useCancelRun,
  usePauseRun,
  usePublishWorkflow,
  useResumeRun,
  useRetryRun,
  useRunWorkflow,
  useWorkflow,
  useWorkflowMetrics,
  useWorkflowRunCheckpoints,
  useWorkflowRunLogs,
  useWorkflowRuns,
  useWorkflowVersions,
} from "@/hooks/use-workflows";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import { LoadingScreen } from "@/components/loading-screen";
import type { WorkflowRunStatus, WorkflowStatus } from "@/lib/api/workflows";

const STATUS_VARIANT: Record<WorkflowStatus, "secondary" | "success" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "success",
  ARCHIVED: "outline",
};

const RUN_STATUS_VARIANT: Record<
  WorkflowRunStatus,
  "secondary" | "success" | "destructive" | "warning" | "outline"
> = {
  PENDING: "secondary",
  RUNNING: "warning",
  SUCCEEDED: "success",
  FAILED: "destructive",
  CANCELLED: "outline",
  PAUSED: "outline",
  WAITING_APPROVAL: "warning",
  TIMED_OUT: "destructive",
};

const RUN_ACTIONABLE_STATUSES: WorkflowRunStatus[] = ["RUNNING", "PAUSED", "FAILED", "WAITING_APPROVAL"];

function formatDuration(durationMs: number | null): string {
  if (!durationMs || durationMs < 1_000) return durationMs === null ? "Not recorded" : "< 1s";
  if (durationMs < 60_000) return `${Math.round(durationMs / 1_000)}s`;
  return `${Math.floor(durationMs / 60_000)}m ${Math.round((durationMs % 60_000) / 1_000)}s`;
}

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
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
  const resumeRun = useResumeRun();
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

  async function handleRunAction(action: typeof pauseRun, runId: string, successMessage: string) {
    try {
      await action.mutateAsync(runId);
      toast.success(successMessage);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (!workflow) return null;

  const latestFailedRun = runs?.items.find((run) => run.status === "FAILED");
  const selectedRun = runs?.items.find((run) => run.id === selectedRunId);
  const selectedVersion = selectedRun ? versions?.find((version) => version.id === selectedRun.workflowVersionId) : undefined;
  const completedStepIds = new Set(runCheckpoints?.map((checkpoint) => checkpoint.stepId) ?? []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/workflows")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Workflows
      </Button>

      <div className="surface-raised flex flex-col gap-5 rounded-xl p-5 sm:p-7 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{workflow.name}</h1>
            <Badge variant={STATUS_VARIANT[workflow.status]}>{workflow.status}</Badge>
          </div>
          {workflow.description && (
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {latestFailedRun && (
            <CopilotButton
              label="Explain failure"
              dialogTitle={`Why did "${workflow.name}" fail?`}
              prompt="Explain why this workflow run likely failed in plain language, and suggest 1-2 concrete improvements to the workflow to prevent it happening again."
              context={[
                `Workflow: ${workflow.name}`,
                workflow.description ? `Description: ${workflow.description}` : "",
                `Failed run error: ${latestFailedRun.error ?? "No error message recorded"}`,
                `Trigger type: ${latestFailedRun.triggerType}`,
              ].filter(Boolean)}
            />
          )}
          {workflow.status === "DRAFT" && (
            <Button variant="outline" onClick={handlePublish} isLoading={publishWorkflow.isPending}>
              <Rocket className="h-4 w-4" />
              Publish
            </Button>
          )}
          {workflow.status === "PUBLISHED" && (
            <Button variant="outline" onClick={handleArchive} isLoading={archiveWorkflow.isPending}>
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => router.push(`/workflows/${id}/builder`)}
          >
            <Wand2 className="h-4 w-4" />
            Open builder
          </Button>
          <Button onClick={handleRun} isLoading={runWorkflow.isPending} disabled={workflow.status === "ARCHIVED"}>
            <Play className="h-4 w-4" />
            Run now
          </Button>
        </div>
      </div>

      <Tabs defaultValue="runs" className="mt-6">
        <TabsList>
          <TabsTrigger value="runs">Runs</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="runs">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm">Run history</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">Select a run to inspect its recorded steps, checkpoints, and log entries.</p>
                </div>
                <Badge variant="outline">{runs?.items.length ?? 0} recorded</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {runs?.items.length === 0 && (
                <EmptyState icon={History} title="No runs yet" description="Trigger a run to see execution history here." />
              )}
              {runs && runs.items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Trigger</TableHead>
                      <TableHead>Started</TableHead>
                      <TableHead className="hidden sm:table-cell">Duration</TableHead>
                      <TableHead className="hidden lg:table-cell">Outcome</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {runs.items.map((run) => (
                      <TableRow
                        key={run.id}
                        className="cursor-pointer"
                        onClick={() => setSelectedRunId(run.id === selectedRunId ? null : run.id)}
                        data-state={run.id === selectedRunId ? "selected" : undefined}
                      >
                        <TableCell>
                          <Badge variant={RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{run.triggerType}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {run.startedAt ? formatRelativeTime(run.startedAt) : "—"}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground sm:table-cell">{formatDuration(run.durationMs)}</TableCell>
                        <TableCell className="hidden max-w-64 truncate text-muted-foreground lg:table-cell">
                          {run.status === "FAILED" ? run.error || "Execution stopped without a recorded error." : run.completedAt ? "Completed" : "In progress"}
                        </TableCell>
                        <TableCell className="text-right" onClick={(event) => event.stopPropagation()}>
                          {RUN_ACTIONABLE_STATUSES.includes(run.status) && (
                            <div className="flex justify-end gap-1">
                              {run.status === "RUNNING" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isLoading={pauseRun.isPending}
                                  onClick={() => handleRunAction(pauseRun, run.id, "Run paused")}
                                >
                                  <Pause className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {run.status === "PAUSED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isLoading={resumeRun.isPending}
                                  onClick={() => handleRunAction(resumeRun, run.id, "Run resumed")}
                                >
                                  <Play className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {run.status === "FAILED" && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isLoading={retryRun.isPending}
                                  onClick={() => handleRunAction(retryRun, run.id, "Run retried")}
                                >
                                  <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              {(run.status === "RUNNING" || run.status === "PAUSED") && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  isLoading={cancelRun.isPending}
                                  onClick={() => handleRunAction(cancelRun, run.id, "Run cancelled")}
                                >
                                  <Square className="h-3.5 w-3.5" />
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
            <Card className="mt-4 overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle className="text-sm">Run detail</CardTitle>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{selectedRun.id}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={RUN_STATUS_VARIANT[selectedRun.status]}>{selectedRun.status.replace("_", " ")}</Badge>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{formatDuration(selectedRun.durationMs)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {selectedRun.status === "FAILED" && (
                  <div className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
                    <div className="flex items-start gap-3">
                      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">Execution stopped before the workflow could finish.</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selectedRun.currentStepId ? `The engine reported a failure while processing step ${selectedRun.currentStepId}.` : "The engine did not record a failing step."} Review the recorded error and logs before retrying.</p>
                        {selectedRun.error && (
                          <details className="mt-3 text-xs">
                            <summary className="cursor-pointer font-medium text-destructive">View recorded error details</summary>
                            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded-md bg-background/70 p-2 font-mono text-[11px] text-foreground">{selectedRun.error}</pre>
                          </details>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {selectedVersion && (
                  <section aria-labelledby="step-timeline-heading" className="mb-5 rounded-lg border border-border/80 bg-secondary/20 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h3 id="step-timeline-heading" className="flex items-center gap-2 text-sm font-medium"><ListChecks className="h-4 w-4 text-primary" />Execution timeline</h3>
                        <p className="mt-1 text-xs text-muted-foreground">Completed states are recorded checkpoints from this run.</p>
                      </div>
                      <span className="text-xs text-muted-foreground">{completedStepIds.size}/{selectedVersion.definition.steps.length} completed</span>
                    </div>
                    <ol className="mt-4 space-y-2">
                      {selectedVersion.definition.steps.map((step) => {
                        const completed = completedStepIds.has(step.id);
                        const active = selectedRun.currentStepId === step.id;
                        const state = completed ? "Completed" : active && selectedRun.status === "FAILED" ? "Failed" : active && selectedRun.status === "WAITING_APPROVAL" ? "Waiting for approval" : active && selectedRun.status === "RUNNING" ? "Running" : "Not reached";
                        const StateIcon = completed ? CheckCircle2 : active && selectedRun.status === "FAILED" ? CircleAlert : Circle;
                        return (
                          <li key={step.id} className="flex items-center gap-3 rounded-md bg-card/70 px-3 py-2">
                            <StateIcon className={completed ? "h-4 w-4 shrink-0 text-emerald-500" : active && selectedRun.status === "FAILED" ? "h-4 w-4 shrink-0 text-destructive" : "h-4 w-4 shrink-0 text-muted-foreground"} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-xs font-medium">{step.name}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">{step.type}</p>
                            </div>
                            <span className="text-[11px] text-muted-foreground">{state}</span>
                          </li>
                        );
                      })}
                    </ol>
                  </section>
                )}

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
                          <div key={log.id} className="flex gap-2 border-b border-border/50 py-1">
                            <span className="shrink-0 text-muted-foreground">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                            <span className="shrink-0 uppercase text-muted-foreground">{log.level}</span>
                            <span>{log.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="checkpoints">
                    {!runCheckpoints?.length && (
                      <p className="py-4 text-sm text-muted-foreground">No checkpoints recorded yet.</p>
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
                              <TableCell className="text-muted-foreground">{checkpoint.stepId}</TableCell>
                              <TableCell className="text-muted-foreground">
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
                <CardTitle className="text-xs font-medium text-muted-foreground">Total runs</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {metrics?.totalRuns ?? "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Success rate</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {metrics ? `${Math.round(metrics.successRate * 100)}%` : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Avg duration</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {metrics && Number(metrics.averageExecutionTimeMs) > 0
                  ? `${Math.round(Number(metrics.averageExecutionTimeMs) / 1000)}s`
                  : "—"}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">Failed runs</CardTitle>
              </CardHeader>
              <CardContent className="text-2xl font-semibold tabular-nums">
                {metrics?.failedRuns ?? "—"}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
