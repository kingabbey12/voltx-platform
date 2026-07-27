import { cn } from "@/lib/utils";
import type { WorkflowStatus, WorkflowRunStatus } from "@/lib/api/workflows";

const STATUS_VARIANT: Record<WorkflowStatus, { className: string }> = {
  DRAFT: { className: "bg-secondary/80 text-secondary-foreground" },
  PUBLISHED: { className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  ARCHIVED: { className: "bg-muted text-muted-foreground" },
};

export function WorkflowStatusBadge({ status }: { status: WorkflowStatus }) {
  const v = STATUS_VARIANT[status];
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", v.className)}>
      {status === "DRAFT" ? "Draft" : status === "PUBLISHED" ? "Published" : "Archived"}
    </span>
  );
}

const RUN_STATUS_VARIANT: Record<WorkflowRunStatus, { className: string; dot: string }> = {
  PENDING: { className: "bg-secondary/80 text-secondary-foreground", dot: "bg-muted-foreground" },
  RUNNING: {
    className: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  SUCCEEDED: {
    className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
    dot: "bg-emerald-500",
  },
  FAILED: {
    className: "bg-red-500/15 text-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  CANCELLED: { className: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  PAUSED: { className: "bg-amber-500/15 text-amber-600 dark:text-amber-400", dot: "bg-amber-500" },
  WAITING_APPROVAL: {
    className: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
    dot: "bg-violet-500",
  },
  TIMED_OUT: {
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
    dot: "bg-orange-500",
  },
};

export function WorkflowRunStatusBadge({ status }: { status: WorkflowRunStatus }) {
  const v = RUN_STATUS_VARIANT[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", v.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", v.dot)} />
      {status === "WAITING_APPROVAL"
        ? "Waiting Approval"
        : status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}
