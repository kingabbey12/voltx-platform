"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Archive, History, Play, Rocket } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CopilotButton } from "@/components/ai/copilot-button";
import {
  useArchiveWorkflow,
  usePublishWorkflow,
  useRunWorkflow,
  useWorkflow,
  useWorkflowRuns,
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

const RUN_STATUS_VARIANT: Record<WorkflowRunStatus, "secondary" | "success" | "destructive" | "warning" | "outline"> = {
  PENDING: "secondary",
  RUNNING: "warning",
  SUCCEEDED: "success",
  FAILED: "destructive",
  CANCELLED: "outline",
  PAUSED: "outline",
  AWAITING_APPROVAL: "warning",
};

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: workflow, isLoading } = useWorkflow(id);
  const { data: runs } = useWorkflowRuns(id);
  const publishWorkflow = usePublishWorkflow();
  const archiveWorkflow = useArchiveWorkflow();
  const runWorkflow = useRunWorkflow(id);

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
      await runWorkflow.mutateAsync();
      toast.success("Workflow run started");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (!workflow) return null;

  const latestFailedRun = runs?.items.find((run) => run.status === "FAILED");

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/workflows")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Workflows
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{workflow.name}</h1>
            <Badge variant={STATUS_VARIANT[workflow.status]}>{workflow.status}</Badge>
          </div>
          {workflow.description && (
            <p className="mt-1 text-sm text-muted-foreground">{workflow.description}</p>
          )}
        </div>
        <div className="flex gap-2">
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
          <Button onClick={handleRun} isLoading={runWorkflow.isPending} disabled={workflow.status === "ARCHIVED"}>
            <Play className="h-4 w-4" />
            Run now
          </Button>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Run history</CardTitle>
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.items.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell>
                      <Badge variant={RUN_STATUS_VARIANT[run.status]}>{run.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{run.triggerType}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {run.startedAt ? formatRelativeTime(run.startedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
