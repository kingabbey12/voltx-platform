"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Handshake, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RecordTimeline } from "@/components/company/record-timeline";
import { LoadingScreen } from "@/components/loading-screen";
import { usePromise, usePromiseTransition, useDeletePromise, useUpdatePromise } from "@/hooks/use-promises";
import { useContacts } from "@/hooks/use-sales";
import { useUsers } from "@/hooks/use-organizations";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate, formatRelativeTime } from "@/lib/format";
import type { PromisePartyRole, PromiseStatus } from "@/lib/api/promises";

const STATUS_VARIANT: Record<PromiseStatus, "secondary" | "success" | "destructive" | "outline"> = {
  PROPOSED: "secondary",
  STANDING: "success",
  FULFILLED: "success",
  RELEASED: "outline",
  BROKEN: "destructive",
};

const AVAILABLE_ACTIONS: Record<PromiseStatus, Array<"stand" | "fulfill" | "release" | "break">> = {
  PROPOSED: ["stand", "release"],
  STANDING: ["fulfill", "release", "break"],
  FULFILLED: [],
  RELEASED: [],
  BROKEN: [],
};

const ACTION_LABEL: Record<"stand" | "fulfill" | "release" | "break", string> = {
  stand: "Move to standing",
  fulfill: "Mark fulfilled",
  release: "Release",
  break: "Mark broken",
};

type EditableParty = { role: PromisePartyRole; kind: "contact" | "user"; id: string };

/**
 * The canonical promise record (docs/design/COMPANY.md §5): one page, one
 * id, everything a door to `promise` opens. Status transitions render
 * optimistically (see usePromiseTransition) and reuse RecordTimeline —
 * the same aggregation the Company Workspace uses.
 */
export default function PromiseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: promise, isLoading } = usePromise(id);
  const { data: contacts } = useContacts({ limit: 100 });
  const { data: users } = useUsers({ limit: 100 });
  const deletePromise = useDeletePromise();
  const updatePromise = useUpdatePromise();
  const [ownerId, setOwnerId] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [parties, setParties] = useState<EditableParty[]>([]);

  const standTransition = usePromiseTransition("stand");
  const fulfillTransition = usePromiseTransition("fulfill");
  const releaseTransition = usePromiseTransition("release");
  const breakTransition = usePromiseTransition("break");

  const transitions = { stand: standTransition, fulfill: fulfillTransition, release: releaseTransition, break: breakTransition };

  useEffect(() => {
    if (!promise) return;
    setOwnerId(promise.ownerId);
    setDueAt(promise.dueAt ? promise.dueAt.slice(0, 10) : "");
    setParties(
      promise.parties.reduce<EditableParty[]>((items, party) => {
        if (party.contactId) items.push({ role: party.role, kind: "contact", id: party.contactId });
        if (party.userId) items.push({ role: party.role, kind: "user", id: party.userId });
        return items;
      }, []),
    );
  }, [promise]);

  async function runAction(action: "stand" | "fulfill" | "release" | "break") {
    try {
      await transitions[action].mutateAsync({ id });
      toast.success(`Promise ${action === "stand" ? "moved to standing" : `${action}d`}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete() {
    try {
      await deletePromise.mutateAsync(id);
      toast.success("Promise deleted");
      router.push("/promises");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function saveDetails() {
    try {
      await updatePromise.mutateAsync({
        id,
        input: {
          ownerId,
          dueAt: dueAt ? new Date(`${dueAt}T00:00:00`).toISOString() : null,
          parties: parties.map((party) => ({
            role: party.role,
            ...(party.kind === "contact" ? { contactId: party.id } : { userId: party.id }),
          })),
        },
      });
      toast.success("Promise details updated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading) return <LoadingScreen />;
  if (!promise) {
    return <p className="mx-auto max-w-4xl px-6 py-8 text-sm text-destructive" role="alert">Promise not found or unavailable.</p>;
  }

  const actions = AVAILABLE_ACTIONS[promise.status];

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Button variant="ghost" size="sm" onClick={() => router.push("/promises")} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4" />
        Promises
      </Button>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
            <Handshake className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{promise.title}</h1>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[promise.status]}>{promise.status}</Badge>
              {promise.dueAt && (
                <span className="text-sm text-muted-foreground">Due {formatDate(promise.dueAt)}</span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive"
          onClick={handleDelete}
          isLoading={deletePromise.isPending}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      </div>

      {actions.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Promise actions">
          {actions.map((action) => (
            <Button
              key={action}
              variant={action === "break" ? "outline" : "default"}
              size="sm"
              onClick={() => runAction(action)}
              isLoading={transitions[action].isPending}
              className={action === "break" ? "text-destructive hover:text-destructive" : undefined}
            >
              {ACTION_LABEL[action]}
            </Button>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 pt-0">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Owner
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger aria-label="Promise owner"><SelectValue placeholder="Choose an owner" /></SelectTrigger>
                <SelectContent>
                  {users?.items.map((user) => (
                    <SelectItem key={user.id} value={user.id}>{`${user.firstName} ${user.lastName}`.trim() || user.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Due date
              <Input type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} />
            </label>
            <Button size="sm" onClick={saveDetails} isLoading={updatePromise.isPending} disabled={!ownerId}>
              Save details
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Parties</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 pt-0">
            {parties.map((party, index) => (
              <div key={`${party.kind}-${party.id}-${index}`} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
                <Select value={party.role} onValueChange={(role: PromisePartyRole) => setParties((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, role } : item))}>
                  <SelectTrigger className="w-28" aria-label={`Role for party ${index + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="OBLIGOR">Obligor</SelectItem><SelectItem value="OBLIGEE">Obligee</SelectItem></SelectContent>
                </Select>
                <Select value={`${party.kind}:${party.id}`} onValueChange={(value) => {
                  const [kind, partyId] = value.split(":");
                  if ((kind !== "contact" && kind !== "user") || !partyId) return;
                  setParties((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, kind: kind as EditableParty["kind"], id: partyId } : item));
                }}>
                  <SelectTrigger className="min-w-40 flex-1" aria-label={`Person for party ${index + 1}`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {contacts?.items.map((contact) => <SelectItem key={`contact:${contact.id}`} value={`contact:${contact.id}`}>{`${contact.firstName} ${contact.lastName}`.trim()}</SelectItem>)}
                    {users?.items.map((user) => <SelectItem key={`user:${user.id}`} value={`user:${user.id}`}>{`${user.firstName} ${user.lastName}`.trim() || user.email} (internal)</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setParties((current) => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove party ${index + 1}`}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            {parties.length === 0 && <p className="text-sm text-muted-foreground">No parties recorded.</p>}
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => {
              const contact = contacts?.items[0];
              const user = users?.items[0];
              if (contact) setParties((current) => [...current, { role: "OBLIGEE", kind: "contact", id: contact.id }]);
              else if (user) setParties((current) => [...current, { role: "OBLIGEE", kind: "user", id: user.id }]);
            }} disabled={!contacts?.items.length && !users?.items.length}>
              <Plus className="h-4 w-4" /> Add party
            </Button>
            <Button size="sm" onClick={saveDetails} isLoading={updatePromise.isPending} disabled={!ownerId}>Save parties</Button>
          </CardContent>
        </Card>
      </div>

      <p className="mt-6 text-xs text-muted-foreground">
        Created {formatDate(promise.createdAt)} · Updated {formatRelativeTime(promise.updatedAt)}
      </p>

      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold">Timeline</h2>
        <RecordTimeline recordType="promise" recordId={id} />
      </div>
    </div>
  );
}
