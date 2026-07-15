"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Lightbulb, Sparkles, Trash2, TrendingUp } from "lucide-react";
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

  const { data: opportunity, isLoading } = useQuery({
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
  if (!opportunity) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/crm/opportunities")}
        className="mb-4 -ml-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Opportunities
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
            <TrendingUp className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{opportunity.title}</h1>
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
        <div className="flex items-center gap-2">
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
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-sm">AI insights</CardTitle>
            <Button size="sm" variant="outline" onClick={handleInsights} isLoading={insights.isPending}>
              <Sparkles className="h-4 w-4" />
              Generate
            </Button>
          </CardHeader>
          <CardContent className="pt-0">
            {opportunity.insights ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{opportunity.insights}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No insights generated yet. Ask the AI to analyze this deal&apos;s strengths, risks, and blockers.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
            <CardTitle className="text-sm">Next best action</CardTitle>
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
              <p className="whitespace-pre-wrap text-sm text-foreground">{opportunity.nextBestAction}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recommendation yet. Ask the AI what to do next to advance this deal.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activities?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          )}
          <div className="flex flex-col gap-2">
            {activities?.items.map((activity) => (
              <div key={activity.id} className="text-sm">
                <p className="font-medium">{activity.subject}</p>
                <p className="text-xs text-muted-foreground">
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
