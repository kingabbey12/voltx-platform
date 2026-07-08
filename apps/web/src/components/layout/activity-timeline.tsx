"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RotateCcw, Search, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useOperatorStore, type CommandTurn } from "@/lib/stores/operator-store";
import { useRunCommand } from "@/hooks/use-operator";
import { agentsApi, type AgentRun } from "@/lib/api/agents";
import { activitiesApi } from "@/lib/api/sales";
import { workflowsApi } from "@/lib/api/workflows";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const UNDOABLE_TOOLS: Record<string, (id: string) => Promise<unknown>> = {
  create_task: (id) => activitiesApi.delete(id),
  create_simple_workflow: (id) => workflowsApi.delete(id),
};

export function ActivityTimeline() {
  const turns = useOperatorStore((state) => state.turns);
  const [inspecting, setInspecting] = useState<CommandTurn | null>(null);

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-3">
          {turns.length === 0 && (
            <EmptyState
              icon={RotateCcw}
              title="No AI activity yet"
              description="Commands you run in Ask will show up here — inspect what happened, retry, or undo."
            />
          )}

          {turns.map((turn) => (
            <TimelineRow key={turn.id} turn={turn} onInspect={() => setInspecting(turn)} />
          ))}
        </div>
      </ScrollArea>

      <InspectDialog turn={inspecting} onClose={() => setInspecting(null)} />
    </div>
  );
}

function TimelineRow({ turn, onInspect }: { turn: CommandTurn; onInspect: () => void }) {
  const { run } = useRunCommand();

  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 hover:bg-secondary">
      <div className="mt-0.5">
        {turn.status === "running" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        {turn.status === "done" && <CheckCircle2 className="h-4 w-4 text-success" />}
        {turn.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{turn.objective}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{formatRelativeTime(new Date(turn.createdAt).toISOString())}</span>
          {turn.allowedActions && (
            <Badge variant="warning" className="text-[9px]">
              actions
            </Badge>
          )}
        </div>
        <div className="mt-1.5 flex gap-1.5">
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={onInspect} disabled={!turn.agentRunId}>
            <Search className="h-3 w-3" />
            Inspect
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => void run(turn.objective)}
            disabled={turn.status === "running"}
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      </div>
    </div>
  );
}

function InspectDialog({ turn, onClose }: { turn: CommandTurn | null; onClose: () => void }) {
  const [runDetail, setRunDetail] = useState<AgentRun | null>(null);
  const [loading, setLoading] = useState(false);
  const [undoing, setUndoing] = useState(false);

  useEffect(() => {
    if (!turn?.agentRunId) {
      setRunDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setRunDetail(null);
    agentsApi
      .getRunTree(turn.agentRunId)
      .then((tree) => {
        if (!cancelled) setRunDetail(tree[0] ?? null);
      })
      .catch((error: unknown) => {
        if (!cancelled) toast.error(friendlyErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [turn?.agentRunId]);

  // A run can call the same mutating tool more than once (e.g. the model
  // deciding to create two tasks in one objective) — undo every creation
  // this run made, not just the first, or the rest are silently orphaned.
  const undoableItems = (runDetail?.output.toolResults ?? [])
    .filter((r) => r.toolName in UNDOABLE_TOOLS && !r.isError)
    .map((r) => {
      let id: string | null = null;
      try {
        id = (JSON.parse(r.content) as { id?: string }).id ?? null;
      } catch {
        id = null;
      }
      return { toolName: r.toolName, id };
    })
    .filter((item): item is { toolName: string; id: string } => item.id !== null);

  async function handleUndo() {
    if (undoableItems.length === 0) return;
    setUndoing(true);
    try {
      await Promise.all(
        undoableItems.map((item) => {
          const undo = UNDOABLE_TOOLS[item.toolName];
          return undo ? undo(item.id) : Promise.resolve();
        }),
      );
      toast.success(undoableItems.length > 1 ? `Undone (${undoableItems.length} items)` : "Undone");
      onClose();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    } finally {
      setUndoing(false);
    }
  }

  return (
    <Dialog open={turn !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{turn?.objective}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading run detail...
          </div>
        )}

        {runDetail && (
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge variant={runDetail.status === "SUCCEEDED" ? "success" : "destructive"}>
                {runDetail.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {runDetail.toolCallCount} tool call{runDetail.toolCallCount === 1 ? "" : "s"} &bull;{" "}
                {runDetail.durationMs ? `${(runDetail.durationMs / 1000).toFixed(1)}s` : "—"}
              </span>
            </div>

            {/* Fixed max-height + scroll, independent of the action button below it —
                a run with many tool calls must never push Undo off-screen. */}
            <div className="max-h-[40vh] overflow-y-auto pr-1">
              {runDetail.output.toolResults && runDetail.output.toolResults.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Tool calls</p>
                  {runDetail.output.toolResults.map((result, i) => (
                    <div key={i} className="rounded-lg border border-border p-2 text-xs">
                      <p className="font-medium">{result.toolName.replace(/_/g, " ")}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">
                        {result.content.slice(0, 300)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {runDetail.error && <p className="text-xs text-destructive">{runDetail.error}</p>}
            </div>

            {undoableItems.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="w-fit text-destructive hover:text-destructive"
                onClick={handleUndo}
                isLoading={undoing}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {undoableItems.length > 1
                  ? `Undo (delete ${undoableItems.length} items this created)`
                  : "Undo (delete what this created)"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
