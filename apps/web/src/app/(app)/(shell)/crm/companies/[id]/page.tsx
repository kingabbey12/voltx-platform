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

export default function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const deleteCompany = useDeleteCompany();

  const { data: company, isLoading } = useQuery({
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
  if (!company) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/crm/companies")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Companies
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{company.name}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={company.status === "ACTIVE" ? "success" : "secondary"}>{company.status}</Badge>
              {company.industry && <span className="text-sm text-muted-foreground">{company.industry}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Contacts</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {contacts?.items.length === 0 && (
              <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
            )}
            <div className="flex flex-col gap-2">
              {contacts?.items.map((contact) => (
                <div key={contact.id} className="text-sm">
                  <p className="font-medium">
                    {contact.firstName} {contact.lastName}
                  </p>
                  {contact.email && <p className="text-xs text-muted-foreground">{contact.email}</p>}
                </div>
              ))}
            </div>
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

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(company.createdAt)}</p>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
        <RecordTimeline recordType="sales.company" recordId={id} />
      </div>
    </div>
  );
}
