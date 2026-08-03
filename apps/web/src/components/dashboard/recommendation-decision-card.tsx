"use client";

import Link from "next/link";
import { useState } from "react";
import { Check, ChevronRight, ExternalLink, FileCheck2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  useApproveRecommendation,
  useDismissRecommendation,
  useExecuteRecommendationAction,
} from "@/hooks/use-dashboard";
import type { DashboardRecommendation } from "@/lib/api/dashboard";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const severityStyle = {
  CRITICAL: "border-destructive/30 bg-destructive/10 text-destructive",
  WARNING: "border-warning/30 bg-warning/10 text-warning",
  OPPORTUNITY: "border-success/30 bg-success/10 text-success",
  INFO: "border-info/30 bg-info/10 text-info",
} as const;

export function RecommendationDecisionCard({ recommendation }: { recommendation: DashboardRecommendation }) {
  const [open, setOpen] = useState(false);
  const approve = useApproveRecommendation();
  const dismiss = useDismissRecommendation();
  const execute = useExecuteRecommendationAction();
  const taskAction = recommendation.actions.find((action) => action.type === "CREATE_TASK");
  const pending = approve.isPending || dismiss.isPending || execute.isPending;

  async function approveAndExecute() {
    await approve.mutateAsync(recommendation.id);
    if (taskAction) {
      await execute.mutateAsync({ recommendationId: recommendation.id, actionId: taskAction.id });
    }
    setOpen(false);
  }

  async function dismissRecommendation() {
    await dismiss.mutateAsync(recommendation.id);
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div className="group rounded-lg border border-border/70 p-4 transition-colors hover:border-primary/30">
        <div className="flex items-start gap-3">
          <span className={cn("mt-1 h-2 w-2 shrink-0 rounded-full", severityStyle[recommendation.severity])} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">{recommendation.title}</p>
              <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold", severityStyle[recommendation.severity])}>
                {recommendation.severity.toLowerCase()}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              <span>Urgency: {recommendation.severity.toLowerCase()}</span>
              <span aria-hidden>•</span>
              <span>Updated {formatRelativeTime(recommendation.generatedAt)}</span>
              {recommendation.confidence !== null && <><span aria-hidden>•</span><span>{Math.round(recommendation.confidence * 100)}% confidence</span></>}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{recommendation.businessImpact}</p>
            <p className="mt-2 text-xs font-medium text-primary">{recommendation.recommendedNextStep}</p>
          </div>
          <DialogTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={`Review ${recommendation.title}`}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        </div>
      </div>

      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <span className={cn("rounded border px-2 py-1 text-xs font-semibold", severityStyle[recommendation.severity])}>
              {recommendation.severity}
            </span>
            <span className="text-xs text-muted-foreground">{recommendation.category}</span>
          </div>
          <DialogTitle className="mt-2">{recommendation.title}</DialogTitle>
          <DialogDescription>{recommendation.summary}</DialogDescription>
        </DialogHeader>

        <section className="space-y-2 border-y border-border/60 py-4">
          <h3 className="text-sm font-semibold">Why you&apos;re seeing this</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{recommendation.explanation}</p>
          {recommendation.confidence !== null && (
            <p className="text-xs text-muted-foreground">Rule confidence: {Math.round(recommendation.confidence * 100)}%</p>
          )}
          <p className="text-xs text-muted-foreground">Last updated: {formatRelativeTime(recommendation.generatedAt)}</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">Supporting evidence and records</h3>
          {recommendation.evidence.length === 0 && <p className="rounded-lg border border-dashed border-border/70 p-3 text-xs leading-relaxed text-muted-foreground">This recommendation has no record-level evidence exposed by the current dashboard response. Review the reasoning before taking action.</p>}
          {recommendation.evidence.length > 0 && <div className="space-y-2">
            {recommendation.evidence.map((evidence) => (
              <Link
                key={`${evidence.type}-${evidence.recordId}`}
                href={evidence.href}
                className="flex items-start gap-3 rounded-md border border-border/60 p-3 transition-colors hover:border-primary/30 hover:bg-muted/30"
              >
                <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{evidence.recordLabel}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{evidence.reason}</span>
                </span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            ))}
          </div>
          }
        </section>

        <section className="space-y-2 border-t border-border/60 pt-4">
          <h3 className="text-sm font-semibold">Expected outcome</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{recommendation.businessImpact}</p>
          <p className="text-sm font-medium text-primary">Suggested action: {recommendation.recommendedNextStep}</p>
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={dismissRecommendation} disabled={pending}>
            <X className="h-4 w-4" /> Dismiss
          </Button>
          {taskAction && recommendation.status === "OPEN" && (
            <Button onClick={approveAndExecute} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Approve and create task
            </Button>
          )}
          {taskAction && recommendation.status === "APPROVED" && (
            <Button
              onClick={() => execute.mutateAsync({ recommendationId: recommendation.id, actionId: taskAction.id }).then(() => setOpen(false))}
              disabled={pending}
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              Create task
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}