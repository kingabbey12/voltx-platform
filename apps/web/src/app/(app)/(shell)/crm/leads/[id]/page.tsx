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

  const { data: lead, isLoading } = useQuery({
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
  if (!lead) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/crm/leads")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Leads
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
            <Target className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{lead.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[lead.status]}>{lead.status}</Badge>
              {lead.source && <span className="text-sm text-muted-foreground">{lead.source}</span>}
              {lead.qualificationScore != null && (
                <span className="text-sm text-muted-foreground">Score: {lead.qualificationScore}/100</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">AI qualification summary</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {lead.qualificationSummary ? (
              <p className="whitespace-pre-wrap text-sm text-foreground">{lead.qualificationSummary}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Not qualified yet. Run AI qualify to assess fit, urgency, and buying signals.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
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
      </div>

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(lead.createdAt)}</p>
    </div>
  );
}
