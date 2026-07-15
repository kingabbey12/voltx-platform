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

export default function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const deleteContact = useDeleteContact();
  const draftEmail = useDraftContactEmail();
  const [draft, setDraft] = useState<string | null>(null);

  const { data: contact, isLoading } = useQuery({
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
  if (!contact) return null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/crm/contacts")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Contacts
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
            <User className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">
              {contact.firstName} {contact.lastName}
            </h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
              {contact.jobTitle && <span>{contact.jobTitle}</span>}
              {contact.email && <span>{contact.email}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
      </div>

      <Card className="mt-6">
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

      <p className="mt-6 text-xs text-muted-foreground">Added {formatDate(contact.createdAt)}</p>

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Drafted email
            </DialogTitle>
          </DialogHeader>
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 text-sm">
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
