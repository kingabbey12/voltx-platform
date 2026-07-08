"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Sparkles, Target, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  const { data, isLoading } = useLeads({ limit: 50 });
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
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{data?.total ?? 0} leads</p>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add lead
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={Target}
            title="No leads yet"
            description="Leads you capture will appear here, ready for AI qualification."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add lead
              </Button>
            }
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">{lead.title}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.source ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[lead.status]}>{lead.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {lead.qualificationScore != null ? `${lead.qualificationScore}/100` : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
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
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
