"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ArrowUpRight, MoreHorizontal, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/query-error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCreateLead, useDeleteLead, useLeads, useQualifyLead } from "@/hooks/use-sales";
import { leadSchema, type LeadFormValues } from "@/lib/validations/crm";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { LeadStatus } from "@/lib/api/sales";

const STATUS_VARIANT: Record<LeadStatus, "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  NEW: "secondary",
  QUALIFIED: "success",
  NURTURING: "warning",
  DISQUALIFIED: "destructive",
  CONVERTED: "outline",
};

export default function LeadsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useLeads({ limit: 50 });
  const createLead = useCreateLead();
  const deleteLead = useDeleteLead();
  const qualifyLead = useQualifyLead();

  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { title: "", source: "", status: "NEW" },
  });

  async function onSubmit(values: LeadFormValues) {
    try {
      await createLead.mutateAsync({
        title: values.title,
        source: values.source || undefined,
        status: values.status,
      });
      toast.success("Lead created");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleQualify(id: string) {
    try {
      await qualifyLead.mutateAsync(id);
      toast.success("AI qualification complete");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteLead.mutateAsync(id);
      toast.success("Lead deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="space-y-5">
      <div className="surface-widget flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-warning">Opportunity intelligence</p><p className="mt-1 text-sm text-muted-foreground">{data?.total ?? 0} signals waiting to be qualified</p></div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add lead
        </Button>
      </div>

      <div className="surface-widget overflow-hidden rounded-[24px]">
        {isLoading && (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-28 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <QueryErrorState title="Leads could not be loaded" onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={Target}
            title="Your next opportunity is waiting"
            description="Capture a lead and Voltx will help you qualify the signal, urgency, and next move."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add lead
              </Button>
            }
          />
        )}

        {!isLoading && !isError && data && data.items.length > 0 && (
          <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-3">
              {data.items.map((lead) => (
                <article key={lead.id} className="surface-interactive group relative min-h-[218px] overflow-hidden rounded-2xl p-5"><div aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-warning/10 blur-3xl" />
                  <div className="relative flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl border border-warning/20 bg-warning/10 text-warning"><Target className="h-5 w-5" /></span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="relative z-10 h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleQualify(lead.id)}>
                          <Sparkles className="h-4 w-4" />
                          AI qualify
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(lead.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu></div>
                    <Link href={`/crm/leads/${lead.id}`} className="relative mt-5 block rounded-lg focus-visible:ring-2 focus-visible:ring-ring"><p className="line-clamp-2 text-base font-semibold leading-snug tracking-tight transition-colors group-hover:text-primary">{lead.title}</p><p className="mt-1 text-xs text-muted-foreground">{lead.source ?? "Source is still being established"}</p></Link>
                    <div className="relative mt-4 flex items-center justify-between border-t border-white/[0.06] pt-3"><Badge variant={STATUS_VARIANT[lead.status]}>{lead.status}</Badge><span className="text-xs font-semibold text-warning">{lead.qualificationScore != null ? `${lead.qualificationScore}/100` : "Awaiting AI"}</span></div>
                    <p className="relative mt-3 line-clamp-1 text-[11px] text-muted-foreground"><Sparkles className="mr-1 inline h-3 w-3 text-warning" />{lead.qualificationSummary ?? "Qualify this lead to reveal confidence and next action."}<ArrowUpRight className="ml-1 inline h-3 w-3" /></p>
                  </article>
              ))}
            </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add lead</DialogTitle>
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
                      <Input placeholder="Enterprise expansion — Acme Inc." autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Website, referral, event..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NEW">New</SelectItem>
                        <SelectItem value="QUALIFIED">Qualified</SelectItem>
                        <SelectItem value="NURTURING">Nurturing</SelectItem>
                        <SelectItem value="DISQUALIFIED">Disqualified</SelectItem>
                        <SelectItem value="CONVERTED">Converted</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createLead.isPending}>
                  Add lead
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
