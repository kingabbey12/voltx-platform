"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Handshake, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePromises, useCreatePromise } from "@/hooks/use-promises";
import { useContacts } from "@/hooks/use-sales";
import { useAuthStore } from "@/lib/stores/auth-store";
import { createPromiseSchema, type CreatePromiseFormValues } from "@/lib/validations/promises";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";
import type { PromiseRecord, PromiseStatus } from "@/lib/api/promises";

const STATUSES: { key: PromiseStatus; label: string }[] = [
  { key: "PROPOSED", label: "Proposed" },
  { key: "STANDING", label: "Standing" },
  { key: "FULFILLED", label: "Fulfilled" },
  { key: "RELEASED", label: "Released" },
  { key: "BROKEN", label: "Broken" },
];

/**
 * The Promise Workspace (docs/design/COMPANY.md §2): every commitment the
 * company holds, grouped by its lifecycle. Every card opens the one
 * canonical detail page at /promises/:id — no duplicate views.
 */
export default function PromisesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = usePromises({ limit: 200 });
  const { data: contacts } = useContacts({ limit: 100 });
  const createPromise = useCreatePromise();
  const currentUserId = useAuthStore((state) => state.user?.id);

  const form = useForm<CreatePromiseFormValues>({
    resolver: zodResolver(createPromiseSchema),
    defaultValues: { title: "", contactId: "", dueAt: "" },
  });

  async function onSubmit(values: CreatePromiseFormValues) {
    if (!currentUserId) return;
    try {
      await createPromise.mutateAsync({
        title: values.title,
        ownerId: currentUserId,
        dueAt: values.dueAt ? new Date(values.dueAt).toISOString() : undefined,
        parties: [{ role: "OBLIGEE", contactId: values.contactId }],
      });
      toast.success("Promise proposed");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const byStatus = (status: PromiseStatus) => data?.items.filter((p) => p.status === status) ?? [];

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Promises</h1>
          <p className="text-sm text-muted-foreground">{data?.total ?? 0} commitments</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Propose a promise
        </Button>
      </div>

      {!isLoading && data?.items.length === 0 && (
        <div className="mt-6 rounded-xl border border-border">
          <EmptyState
            icon={Handshake}
            title="No promises yet"
            description="A promise is the company's commitment to someone — propose one to start tracking it."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Propose a promise
              </Button>
            }
          />
        </div>
      )}

      {(isLoading || (data && data.items.length > 0)) && (
        <div
          className="mt-6 flex gap-3 overflow-x-auto pb-2"
          role="list"
          aria-label="Promises by status"
        >
          {STATUSES.map((status) => (
            <div key={status.key} className="w-[260px] shrink-0" role="listitem">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{status.label}</p>
                <span className="text-xs text-muted-foreground">{byStatus(status.key).length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {isLoading &&
                  [1, 2].map((i) => (
                    <div key={i} className="h-16 animate-pulse rounded-xl bg-secondary/60" />
                  ))}
                {byStatus(status.key).map((promise) => (
                  <PromiseCard key={promise.id} promise={promise} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Propose a promise</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Standing reorder — Marlin Hospitality" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Who is the company promising?</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a contact" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {contacts?.items.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.firstName} {contact.lastName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="dueAt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Due date (optional)</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createPromise.isPending}>
                  Propose
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromiseCard({ promise }: { promise: PromiseRecord }) {
  return (
    <Link href={`/promises/${promise.id}`}>
      <Card className="p-3 transition-colors hover:border-primary/40">
        <p className="text-sm font-medium leading-snug">{promise.title}</p>
        {promise.dueAt && (
          <p className="mt-1 text-xs text-muted-foreground">Due {formatDate(promise.dueAt)}</p>
        )}
        <Badge variant="outline" className="mt-2">
          {promise.parties.length} {promise.parties.length === 1 ? "party" : "parties"}
        </Badge>
      </Card>
    </Link>
  );
}
