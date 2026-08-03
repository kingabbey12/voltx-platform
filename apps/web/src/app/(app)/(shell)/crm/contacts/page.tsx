"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Mail, MoreHorizontal, Plus, Sparkles, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/query-error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContacts, useCreateContact, useDeleteContact } from "@/hooks/use-sales";
import { contactSchema, type ContactFormValues } from "@/lib/validations/crm";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useContacts({
    search: search || undefined,
    limit: 50,
  });
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { firstName: "", lastName: "", email: "", jobTitle: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    try {
      await createContact.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        jobTitle: values.jobTitle || undefined,
      });
      toast.success("Contact created");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContact.mutateAsync(id);
      toast.success("Contact deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-widget flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(268_83%_76%)]">Relationships</p><p className="mt-1 text-sm text-muted-foreground">{data?.total ?? 0} people in your customer network</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 min-w-[220px] rounded-xl border-white/[0.09] bg-black/25"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add contact
        </Button></div>
      </div>

      <div className="surface-widget overflow-hidden rounded-[24px]">
        {isLoading && (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-24 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <QueryErrorState title="Contacts could not be loaded" onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={Users}
            title="Build your relationship intelligence"
            description="Add the people who shape your accounts, deals, and next customer conversations."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add contact
              </Button>
            }
          />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((contact) => (
                <article key={contact.id} className="surface-interactive group relative min-h-[190px] overflow-hidden rounded-2xl p-5"><div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-[hsl(268_83%_68%/0.12)] blur-3xl" />
                  <div className="relative flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-full border border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)] shadow-[0_10px_22px_-16px_hsl(268_83%_68%/0.9)]">{`${contact.firstName[0] ?? ""}${contact.lastName[0] ?? ""}`}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative z-10 h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu></div>
                    <Link href={`/crm/contacts/${contact.id}`} className="relative mt-5 block rounded-lg focus-visible:ring-2 focus-visible:ring-ring"><p className="truncate text-base font-semibold tracking-tight transition-colors group-hover:text-primary">{contact.firstName} {contact.lastName}</p><p className="mt-1 truncate text-xs text-muted-foreground">{contact.jobTitle ?? "Relationship context is being built"}</p></Link>
                    <div className="relative mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3"><span className="inline-flex min-w-0 items-center gap-1 truncate text-[11px] text-muted-foreground"><Mail className="h-3 w-3" />{contact.email ?? "No email yet"}</span><Sparkles className="h-3.5 w-3.5 shrink-0 text-[hsl(268_83%_76%)]" /></div>
                  </article>
              ))}
            </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createContact.isPending}>
                  Add contact
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
