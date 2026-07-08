"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Plus, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
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
  const { data, isLoading } = useOpportunities({ limit: 100 });
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
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} opportunities</p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add opportunity
        </Button>
      </div>

      {!isLoading && data?.items.length === 0 && (
        <div className="mt-4 rounded-xl border border-border">
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

      {(isLoading || (data && data.items.length > 0)) && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
          {STAGES.map((stage) => (
            <div key={stage.key} className="w-[240px] shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{stage.label}</p>
                <span className="text-xs text-muted-foreground">{byStage(stage.key).length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {isLoading &&
                  [1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-secondary/60" />)}
                {byStage(stage.key).map((opportunity) => (
                  <Card key={opportunity.id} className="p-3">
                    <p className="text-sm font-medium leading-snug">{opportunity.title}</p>
                    {opportunity.amount != null && (
                      <p className="mt-1 text-sm text-primary">
                        {formatCurrency(opportunity.amount, opportunity.currency)}
                      </p>
                    )}
                    <Select
                      value={opportunity.stage}
                      onValueChange={(value) => moveStage(opportunity, value as OpportunityStage)}
                    >
                      <SelectTrigger className="mt-2 h-7 text-xs">
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
