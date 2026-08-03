"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CopilotButton } from "@/components/ai/copilot-button";
import { RecordTimeline } from "@/components/company/record-timeline";
import { companiesApi } from "@/lib/api/sales";
import { useDeleteCompany, useContacts, useActivities } from "@/hooks/use-sales";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { LoadingScreen } from "@/components/loading-screen";
import { DetailLoadState } from "@/components/detail-load-state";

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const deleteCompany = useDeleteCompany();

  const { data: company, isLoading, error, refetch } = useQuery({
    queryKey: ["sales", "companies", id],
    queryFn: () => companiesApi.get(id),
  });
  const { data: contacts } = useContacts({ companyId: id, limit: 10 });
  const { data: activities } = useActivities({ companyId: id, limit: 10 });

  async function handleDelete() {
    try {
      await deleteCompany.mutateAsync(id);
      toast.success("Company deleted");
      router.push("/crm/companies");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (!company) {
    return (
      <DetailLoadState
        entityName="Company"
        backHref="/crm/companies"
        backLabel="Back to companies"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/crm/companies")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Companies
      </Button>

      <div className="surface-raised relative overflow-hidden rounded-[24px] p-5 sm:p-7">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-info/10 blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-info/20 bg-info/10 text-info shadow-[0_12px_26px_-18px_hsl(var(--info)/0.9)]">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-info">Account intelligence</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{company.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={company.status === "ACTIVE" ? "success" : "secondary"}>{company.status}</Badge>
              {company.industry && <span className="text-sm text-muted-foreground">{company.industry}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <CopilotButton
            label="Summarize"
            dialogTitle={`Summary: ${company.name}`}
            prompt="Summarize this company for someone about to reach out: who they are, the state of the relationship, and a recommended next step."
            context={[
              `Company: ${company.name}`,
              `Status: ${company.status}`,
              company.industry ? `Industry: ${company.industry}` : "",
              `Contacts: ${contacts?.items.map((c) => `${c.firstName} ${c.lastName}`).join(", ") || "none"}`,
              `Recent activity: ${activities?.items.map((a) => a.subject).join(", ") || "none"}`,
            ].filter(Boolean)}
          />
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div></div>

      <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card className="surface-widget rounded-[24px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Relationship map</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {contacts?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Add the people who shape this account to start building relationship context.</p>
            )}
            <div className="space-y-2">
              {contacts?.items.map((contact) => (
                <div key={contact.id} className="rounded-xl border border-white/[0.06] bg-black/15 p-3 text-sm">
                  <p className="font-medium">
                    {contact.firstName} {contact.lastName}
                  </p>
                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="surface-widget rounded-[24px]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Account pulse</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {activities?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">Log the next customer touchpoint to bring this account timeline to life.</p>
            )}
            <div className="relative space-y-3 before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-px before:bg-white/[0.08]">
              {activities?.items.map((activity) => (
                <div key={activity.id} className="relative pl-6 text-sm"><span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-info/30 bg-card shadow-[0_0_10px_hsl(var(--info)/0.45)]" />
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

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(company.createdAt)}</p>

      <div className="surface-widget mt-6 rounded-[24px] p-5 sm:p-6">
        <h2 className="mb-4 text-base font-semibold tracking-tight">Account timeline</h2>
        <RecordTimeline recordType="sales.company" recordId={id} />
      </div>
    </div>
  );
}
