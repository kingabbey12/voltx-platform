"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotButton } from "@/components/ai/copilot-button";
import { leadsApi } from "@/lib/api/sales";
import { useActivities, useDeleteLead, useQualifyLead } from "@/hooks/use-sales";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { LoadingScreen } from "@/components/loading-screen";
import { DetailLoadState } from "@/components/detail-load-state";
import type { LeadStatus } from "@/lib/api/sales";

const STATUS_VARIANT: Record<LeadStatus, "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  NEW: "secondary",
  QUALIFIED: "success",
  NURTURING: "warning",
  DISQUALIFIED: "destructive",
  CONVERTED: "outline",
};

export default function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const deleteLead = useDeleteLead();
  const qualifyLead = useQualifyLead();

  const { data: lead, isLoading, error, refetch } = useQuery({
    queryKey: ["sales", "leads", id],
    queryFn: () => leadsApi.get(id),
  });
  const { data: activities } = useActivities({ leadId: id, limit: 10 });

  async function handleDelete() {
    try {
      await deleteLead.mutateAsync(id);
      toast.success("Lead deleted");
      router.push("/crm/leads");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleQualify() {
    try {
      await qualifyLead.mutateAsync(id);
      toast.success("AI qualification complete");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (!lead) {
    return (
      <DetailLoadState
        entityName="Lead"
        backHref="/crm/leads"
        backLabel="Back to leads"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/crm/leads")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Leads
      </Button>

      <div className="surface-raised relative overflow-hidden rounded-[24px] p-5 sm:p-7"><div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-warning/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-warning/20 bg-warning/10 text-warning shadow-[0_12px_26px_-18px_hsl(var(--warning)/0.9)]">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-warning">Qualification command center</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{lead.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[lead.status]}>{lead.status}</Badge>
              {lead.source && <span className="text-sm text-muted-foreground">{lead.source}</span>}
              {lead.qualificationScore != null && (
                <span className="text-sm text-muted-foreground">Score: {lead.qualificationScore}/100</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleQualify} isLoading={qualifyLead.isPending}>
            <Sparkles className="h-4 w-4" />
            AI qualify
          </Button>
          <CopilotButton
            label="Summarize"
            dialogTitle={`Summary: ${lead.title}`}
            prompt="Summarize this lead for someone about to follow up: fit, urgency, and a recommended next step."
            context={[
              `Lead: ${lead.title}`,
              `Status: ${lead.status}`,
              lead.source ? `Source: ${lead.source}` : "",
              `Recent activity: ${activities?.items.map((a) => a.subject).join(", ") || "none"}`,
            ].filter(Boolean)}
          />
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div></div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2"><div className="surface-widget rounded-2xl p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Qualification score</p><p className="mt-2 text-xl font-semibold tracking-tight text-warning">{lead.qualificationScore != null ? `${lead.qualificationScore}/100` : "Awaiting AI"}</p></div><div className="surface-widget rounded-2xl p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Signal source</p><p className="mt-2 text-xl font-semibold tracking-tight">{lead.source ?? "Not set"}</p></div></div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="surface-widget rounded-[24px]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base"><span className="grid h-8 w-8 place-items-center rounded-xl border border-warning/20 bg-warning/10 text-warning"><Sparkles className="h-4 w-4" /></span>AI qualification summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {lead.qualificationSummary ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{lead.qualificationSummary}</p>
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                Run AI qualification to assess fit, urgency, and the signals behind a confident next move.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="surface-widget rounded-[24px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Lead activity</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activities?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Log the next interaction to enrich the qualification context.</p>
            )}
            <div className="relative space-y-3 before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-px before:bg-white/[0.08]">
              {activities?.items.map((activity) => (
                <div key={activity.id} className="relative pl-6 text-sm"><span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-warning/30 bg-card shadow-[0_0_10px_hsl(var(--warning)/0.45)]" />
                  <p className="font-medium">{activity.subject}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(activity.occurredAt ?? activity.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(lead.createdAt)}</p>
    </div>
  );
}
