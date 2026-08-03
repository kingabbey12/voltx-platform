"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, GitCommitHorizontal, RotateCw, Settings2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStepTypeSpec } from "@/lib/workflow-step-catalog";
import type { WorkflowStepType } from "@/lib/api/workflows";

export interface WorkflowStepNodeData extends Record<string, unknown> {
  name: string;
  type: WorkflowStepType;
  hasCondition: boolean;
  configCount?: number;
  retryAttempts?: number;
  error?: string;
}

const CATEGORY_STYLE = {
  AI: "border-violet-500/25 bg-violet-500/10 text-violet-500",
  Communication: "border-sky-500/25 bg-sky-500/10 text-sky-500",
  Integration: "border-cyan-500/25 bg-cyan-500/10 text-cyan-500",
  "Control flow": "border-amber-500/25 bg-amber-500/10 text-amber-500",
};

function WorkflowStepNodeImpl({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowStepNodeData;
  const spec = getStepTypeSpec(nodeData.type);
  const Icon = spec.icon;
  const isApproval = nodeData.type === "APPROVAL";

  return (
    <div
      role="group"
      aria-label={`${nodeData.name}, ${spec.label}${nodeData.hasCondition ? ", conditional" : ""}${isApproval ? ", requires approval" : ""}${nodeData.error ? `, error: ${nodeData.error}` : ""}`}
      className={cn(
        "min-w-[236px] rounded-xl border bg-card/95 px-3.5 py-3 shadow-[0_12px_28px_-22px_rgba(0,0,0,0.8)] transition-[border-color,box-shadow,transform] duration-200",
        selected ? "border-primary shadow-[0_14px_34px_-20px_hsl(var(--primary)/0.75)] ring-2 ring-primary/25" : "border-border/80",
        nodeData.error && "border-destructive/70",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2.5 !w-2.5 !border-2 !border-card !bg-primary" />
      <div className="flex items-center gap-2">
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border", CATEGORY_STYLE[spec.category])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{nodeData.name}</p>
          <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">{spec.label}</p>
        </div>
        {nodeData.error && <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0 text-destructive" />}
      </div>
      <p className="mt-2 line-clamp-2 min-h-8 text-[11px] leading-relaxed text-muted-foreground">{spec.description}</p>
      <div className="mt-2 flex flex-wrap gap-1.5 border-t border-border/60 pt-2">
        <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
          <Settings2 className="h-3 w-3" />
          {nodeData.configCount ?? 0} setting{nodeData.configCount === 1 ? "" : "s"}
        </span>
        {nodeData.hasCondition && (
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <GitCommitHorizontal className="h-3 w-3" />
            Conditional
          </span>
        )}
        {nodeData.retryAttempts && (
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <RotateCw className="h-3 w-3" />
            Retry {nodeData.retryAttempts}
          </span>
        )}
        {isApproval && (
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-700 dark:text-amber-400">
            <ShieldCheck className="h-3 w-3" />
            Approval pause
          </span>
        )}
        {nodeData.error && <span className="text-[10px] font-medium text-destructive">Needs attention</span>}
      </div>
      {nodeData.error && (
        <p className="mt-2 line-clamp-2 rounded-md bg-destructive/10 px-2 py-1 text-[10px] leading-relaxed text-destructive">
          {nodeData.error}
        </p>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-2.5 !w-2.5 !border-2 !border-card !bg-primary" />
    </div>
  );
}

export const WorkflowStepNode = memo(WorkflowStepNodeImpl);
