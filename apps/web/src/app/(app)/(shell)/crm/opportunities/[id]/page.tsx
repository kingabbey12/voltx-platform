"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarClock, Lightbulb, Sparkles, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotButton } from "@/components/ai/copilot-button";
import { opportunitiesApi } from "@/lib/api/sales";
import {
  useActivities,
  useDeleteOpportunity,
  useOpportunityInsights,
  useOpportunityNextBestAction,
} from "@/hooks/use-sales";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { LoadingScreen } from "@/components/loading-screen";
import { DetailLoadState } from "@/components/detail-load-state";
import { MarkdownMessage } from "@/components/ai/markdown-message";
import type { OpportunityStage } from "@/lib/api/sales";

const STAGE_LABEL: Record<OpportunityStage, string> = {
  DISCOVERY: "Discovery",
  QUALIFICATION: "Qualification",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
};

const STAGE_VARIANT: Record<OpportunityStage, "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  DISCOVERY: "secondary",
  QUALIFICATION: "outline",
  PROPOSAL: "warning",
  NEGOTIATION: "warning",
  CLOSED_WON: "success",
  CLOSED_LOST: "destructive",
};

export default function OpportunityDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const deleteOpportunity = useDeleteOpportunity();
  const insights = useOpportunityInsights();
  const nextBestAction = useOpportunityNextBestAction();

  const { data: opportunity, isLoading, error, refetch } = useQuery({
    queryKey: ["sales", "opportunities", id],
    queryFn: () => opportunitiesApi.get(id),
  });
  const { data: activities } = useActivities({ opportunityId: id, limit: 10 });

  async function handleDelete() {
    try {
      await deleteOpportunity.mutateAsync(id);
      toast.success("Opportunity deleted");
      router.push("/crm/opportunities");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleInsights() {
    try {
      await insights.mutateAsync({ id });
      toast.success("Insights generated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleNextBestAction() {
    try {
      await nextBestAction.mutateAsync({ id });
      toast.success("Next best action generated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (!opportunity) {
    return (
      <DetailLoadState
        entityName="Opportunity"
        backHref="/crm/opportunities"
        backLabel="Back to opportunities"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/crm/opportunities")}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Opportunities
      </Button>

      <div className="surface-raised relative overflow-hidden rounded-[24px] p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/15 to-accent/15 text-primary shadow-[0_12px_26px_-18px_hsl(var(--primary)/0.9)]">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">Deal command center</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{opportunity.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STAGE_VARIANT[opportunity.stage]}>{STAGE_LABEL[opportunity.stage]}</Badge>
              {opportunity.amount != null && (
                <span className="text-sm text-muted-foreground">
                  {formatCurrency(opportunity.amount, opportunity.currency)}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopilotButton
            label="Summarize"
            dialogTitle={`Summary: ${opportunity.title}`}
            prompt="Summarize this opportunity for someone about to work it: current stage, deal health, and a recommended next step."
            context={[
              `Opportunity: ${opportunity.title}`,
              `Stage: ${opportunity.stage}`,
              opportunity.amount != null
                ? `Amount: ${formatCurrency(opportunity.amount, opportunity.currency)}`
                : "",
              `Recent activity: ${activities?.items.map((a) => a.subject).join(", ") || "none"}`,
            ].filter(Boolean)}
          />
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div></div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="surface-widget rounded-2xl p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Deal value</p><p className="mt-2 text-xl font-semibold tracking-tight">{opportunity.amount != null ? formatCurrency(opportunity.amount, opportunity.currency) : "Not set"}</p></div>
        <div className="surface-widget rounded-2xl p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Win probability</p><p className="mt-2 text-xl font-semibold tracking-tight text-success">{opportunity.probability}%</p></div>
        <div className="surface-widget rounded-2xl p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Expected close</p><p className="mt-2 inline-flex items-center gap-1.5 text-xl font-semibold tracking-tight">{opportunity.expectedCloseAt ? <><CalendarClock className="h-4 w-4 text-primary" />{formatDate(opportunity.expectedCloseAt)}</> : "Not set"}</p></div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="surface-widget rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><span className="grid h-8 w-8 place-items-center rounded-xl border border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]"><Sparkles className="h-4 w-4" /></span>AI insights</CardTitle>
            <Button size="sm" variant="outline" onClick={handleInsights} isLoading={insights.isPending}>
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {opportunity.insights ? (
              <MarkdownMessage content={opportunity.insights} />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Ask Voltx to analyze this deal&apos;s strengths, risks, and blockers before the next customer move.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-widget rounded-[24px]">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><span className="grid h-8 w-8 place-items-center rounded-xl border border-primary/20 bg-primary/10 text-primary"><Lightbulb className="h-4 w-4" /></span>Next best action</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={handleNextBestAction}
              isLoading={nextBestAction.isPending}
            >
              <Lightbulb className="h-4 w-4" />
              Generate
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {opportunity.nextBestAction ? (
              <MarkdownMessage content={opportunity.nextBestAction} />
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Ask Voltx what to do next to advance this deal with confidence.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="surface-widget mt-4 rounded-[24px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Deal activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activities?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Log the next customer touchpoint to give Voltx richer deal context.</p>
          )}
          <div className="relative space-y-3 before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-px before:bg-white/[0.08]">
            {activities?.items.map((activity) => (
              <div key={activity.id} className="relative pl-6 text-sm"><span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-primary/30 bg-card shadow-[0_0_10px_hsl(var(--primary)/0.45)]" />
                <p className="font-medium">{activity.subject}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatRelativeTime(activity.occurredAt ?? activity.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(opportunity.createdAt)}</p>
    </div>
  );
}
