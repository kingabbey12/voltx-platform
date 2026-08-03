"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CalendarClock, Plus, Sparkles, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { QueryErrorState } from "@/components/query-error-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateOpportunity, useOpportunities, useUpdateOpportunity } from "@/hooks/use-sales";
import { opportunitySchema, type OpportunityFormValues } from "@/lib/validations/crm";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatCurrency } from "@/lib/format";
import type { Opportunity, OpportunityStage } from "@/lib/api/sales";

const STAGES: { key: OpportunityStage; label: string }[] = [
  { key: "DISCOVERY", label: "Discovery" },
  { key: "QUALIFICATION", label: "Qualification" },
  { key: "PROPOSAL", label: "Proposal" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "CLOSED_WON", label: "Closed Won" },
  { key: "CLOSED_LOST", label: "Closed Lost" },
];

export default function OpportunitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading, isError, refetch } = useOpportunities({ limit: 100 });
  const createOpportunity = useCreateOpportunity();
  const updateOpportunity = useUpdateOpportunity();

  const form = useForm<OpportunityFormValues>({
    resolver: zodResolver(opportunitySchema),
    defaultValues: { title: "", stage: "DISCOVERY", amount: undefined },
  });

  async function onSubmit(values: OpportunityFormValues) {
    try {
      await createOpportunity.mutateAsync({
        title: values.title,
        stage: values.stage,
        amount: values.amount,
      });
      toast.success("Opportunity created");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function moveStage(opportunity: Opportunity, stage: OpportunityStage) {
    try {
      await updateOpportunity.mutateAsync({ id: opportunity.id, input: { stage } });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const byStage = (stage: OpportunityStage) => data?.items.filter((o) => o.stage === stage) ?? [];

  return (
    <div className="space-y-5">
      <div className="surface-widget flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-primary">Revenue command center</p><p className="mt-1 text-sm text-muted-foreground">{data?.total ?? 0} active opportunities across your pipeline</p></div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add opportunity
        </Button>
      </div>

      {!isLoading && data?.items.length === 0 && (
        <div className="surface-widget rounded-[24px]">
          <EmptyState
            icon={TrendingUp}
            title="No opportunities yet"
            description="Track deals through your pipeline from discovery to close."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add opportunity
              </Button>
            }
          />
        </div>
      )}

      {!isLoading && isError && (
        <div className="surface-widget rounded-[24px]">
          <QueryErrorState title="Opportunities could not be loaded" onRetry={() => void refetch()} />
        </div>
      )}

      {!isError && (isLoading || (data && data.items.length > 0)) && (
        <div className="flex gap-4 overflow-x-auto pb-3">
          {STAGES.map((stage) => (
            <div key={stage.key} className="w-[286px] shrink-0 rounded-[24px] border border-white/[0.07] bg-[linear-gradient(180deg,hsl(0_0%_100%/0.035),transparent_30%),hsl(0_0%_5%/0.72)] p-3 backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between px-1">
                <p className="text-xs font-semibold text-foreground">{stage.label}</p>
                <span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-0.5 text-[11px] text-muted-foreground">{byStage(stage.key).length}</span>
              </div>
              <div className="flex min-h-[160px] flex-col gap-2.5">
                {isLoading &&
                  [1, 2].map((i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}
                {byStage(stage.key).map((opportunity) => (
                  <Card key={opportunity.id} variant="interactive" className="group rounded-2xl border-white/[0.08] p-4">
                    <Link
                      href={`/crm/opportunities/${opportunity.id}`}
                      className="block text-sm font-semibold leading-snug tracking-tight hover:text-primary"
                    >
                      {opportunity.title}
                    </Link>
                    {opportunity.amount != null && (
                      <p className="mt-2 text-lg font-semibold tracking-tight text-primary">
                        {formatCurrency(opportunity.amount, opportunity.currency)}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-3"><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3 w-3 text-primary" />{opportunity.probability}% likely</span>{opportunity.expectedCloseAt && <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><CalendarClock className="h-3 w-3" />{new Date(opportunity.expectedCloseAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>}</div>
                    <Select
                      value={opportunity.stage}
                      onValueChange={(value) => moveStage(opportunity, value as OpportunityStage)}
                    >
                      <SelectTrigger className="mt-3 h-8 rounded-lg border-white/[0.08] bg-black/20 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add opportunity</DialogTitle>
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
                      <Input placeholder="Acme Inc. — Enterprise plan" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (optional)</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} placeholder="50000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Stage</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {STAGES.map((s) => (
                          <SelectItem key={s.key} value={s.key}>
                            {s.label}
                          </SelectItem>
                        ))}
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
                <Button type="submit" isLoading={createOpportunity.isPending}>
                  Add opportunity
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
