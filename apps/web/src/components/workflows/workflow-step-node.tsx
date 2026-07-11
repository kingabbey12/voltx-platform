"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { AlertTriangle, GitCommitHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStepTypeSpec } from "@/lib/workflow-step-catalog";
import type { WorkflowStepType } from "@/lib/api/workflows";

export interface WorkflowStepNodeData extends Record<string, unknown> {
  name: string;
  type: WorkflowStepType;
  hasCondition: boolean;
  error?: string;
}

function WorkflowStepNodeImpl({ data, selected }: NodeProps) {
  const nodeData = data as WorkflowStepNodeData;
  const spec = getStepTypeSpec(nodeData.type);
  const Icon = spec.icon;

  return (
    <div
      className={cn(
        "min-w-[200px] rounded-xl border bg-card px-3 py-2.5 shadow-sm transition-shadow",
        selected ? "border-primary ring-2 ring-primary/30" : "border-border",
        nodeData.error && "border-destructive",
      )}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium leading-tight">{nodeData.name}</p>
          <p className="text-[11px] leading-tight text-muted-foreground">{spec.label}</p>
        </div>
        {nodeData.error && <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0 text-destructive" />}
      </div>
      {nodeData.hasCondition && (
        <div className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground">
          <GitCommitHorizontal className="h-3 w-3" />
          Conditional
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !bg-muted-foreground" />
    </div>
  );
}

export const WorkflowStepNode = memo(WorkflowStepNodeImpl);
