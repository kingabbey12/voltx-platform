"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Copy, Mail, Sparkles, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CopilotButton } from "@/components/ai/copilot-button";
import { contactsApi } from "@/lib/api/sales";
import { useActivities, useDeleteContact, useDraftContactEmail } from "@/hooks/use-sales";
import { formatDate, formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { LoadingScreen } from "@/components/loading-screen";
import { DetailLoadState } from "@/components/detail-load-state";

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const deleteContact = useDeleteContact();
  const draftEmail = useDraftContactEmail();
  const [draft, setDraft] = useState<string | null>(null);

  const { data: contact, isLoading, error, refetch } = useQuery({
    queryKey: ["sales", "contacts", id],
    queryFn: () => contactsApi.get(id),
  });
  const { data: activities } = useActivities({ contactId: id, limit: 10 });

  async function handleDelete() {
    try {
      await deleteContact.mutateAsync(id);
      toast.success("Contact deleted");
      router.push("/crm/contacts");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDraftEmail() {
    try {
      const result = await draftEmail.mutateAsync({ id });
      setDraft(result.outputText);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function copyDraft() {
    if (!draft) return;
    void navigator.clipboard.writeText(draft);
    toast.success("Copied to clipboard");
  }

  if (isLoading) return <LoadingScreen />;
  if (!contact) {
    return (
      <DetailLoadState
        entityName="Contact"
        backHref="/crm/contacts"
        backLabel="Back to contacts"
        error={error}
        onRetry={() => void refetch()}
      />
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/crm/contacts")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Button>

      <div className="surface-raised relative overflow-hidden rounded-[24px] p-5 sm:p-7"><div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[hsl(268_83%_68%/0.12)] blur-3xl" />
      <div className="relative flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)] shadow-[0_12px_26px_-18px_hsl(268_83%_68%/0.9)]">
            <User className="h-6 w-6" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(268_83%_76%)]">Relationship intelligence</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              {contact.firstName} {contact.lastName}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {contact.jobTitle && <span>{contact.jobTitle}</span>}
              {contact.email && <span>{contact.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={handleDraftEmail} isLoading={draftEmail.isPending}>
            <Mail className="h-4 w-4" />
            Draft email
          </Button>
          <CopilotButton
            label="Summarize"
            dialogTitle={`Summary: ${contact.firstName} ${contact.lastName}`}
            prompt="Summarize this contact for someone about to reach out: who they are, the state of the relationship, and a recommended next step."
            context={[
              `Contact: ${contact.firstName} ${contact.lastName}`,
              contact.jobTitle ? `Title: ${contact.jobTitle}` : "",
              contact.email ? `Email: ${contact.email}` : "",
              `Recent activity: ${activities?.items.map((a) => a.subject).join(", ") || "none"}`,
            ].filter(Boolean)}
          />
          <Button variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </div></div>

      <Card className="surface-widget mt-5 rounded-[24px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Relationship timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {activities?.items.length === 0 && (
            <p className="text-sm text-muted-foreground">Log the next touchpoint to give this relationship useful context.</p>
          )}
          <div className="relative space-y-3 before:absolute before:bottom-2 before:left-1.5 before:top-2 before:w-px before:bg-white/[0.08]">
            {activities?.items.map((activity) => (
              <div key={activity.id} className="relative pl-6 text-sm"><span className="absolute left-0 top-1.5 h-3 w-3 rounded-full border border-[hsl(268_83%_68%/0.3)] bg-card shadow-[0_0_10px_hsl(268_83%_68%/0.45)]" />
                <p className="font-medium">{activity.subject}</p>
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(activity.occurredAt ?? activity.createdAt)}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(contact.createdAt)}</p>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Drafted email
            </DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-2xl border border-white/[0.08] bg-black/25 p-4 text-sm">
            {draft}
          </p>
          <Button variant="outline" onClick={copyDraft} className="self-end">
            <Copy className="h-4 w-4" />
            Copy
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
