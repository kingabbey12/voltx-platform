"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { MoreHorizontal, Plus, Trash2, Workflow as WorkflowIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageHeader } from "@/components/layout/page-header";
import { useCreateWorkflow, useDeleteWorkflow, useWorkflows } from "@/hooks/use-workflows";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import type { WorkflowStatus } from "@/lib/api/workflows";

const workflowFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(1000).optional(),
  objective: z.string().trim().min(1, "Describe what this workflow's AI step should do").max(2000),
});
type WorkflowFormValues = z.infer<typeof workflowFormSchema>;

const STATUS_VARIANT: Record<WorkflowStatus, "secondary" | "success" | "outline"> = {
  DRAFT: "secondary",
  PUBLISHED: "success",
  ARCHIVED: "outline",
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  const form = useForm<WorkflowFormValues>({
    resolver: zodResolver(workflowFormSchema),
    defaultValues: { name: "", description: "", objective: "" },
  });

  async function onSubmit(values: WorkflowFormValues) {
    try {
      await createWorkflow.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        definition: {
          steps: [
            {
              id: "step-1",
              name: values.name,
              type: "AGENT",
              config: { agentName: "Workflow Assistant", objective: values.objective },
            },
          ],
        },
      });
      toast.success("Workflow created as draft");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteWorkflow.mutateAsync(id);
      toast.success("Workflow deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Workflows"
        description="Automate multi-step processes — including AI reasoning steps."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New workflow
          </Button>
        }
      />

      <div className="mt-6 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={WorkflowIcon}
            title="No workflows yet"
            description="Build your first automated, multi-step process."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New workflow
              </Button>
            }
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((workflow) => (
                <TableRow key={workflow.id} className="cursor-pointer" onClick={() => router.push(`/workflows/${workflow.id}`)}>
                  <TableCell>
                    <p className="font-medium">{workflow.name}</p>
                    {workflow.description && (
                      <p className="truncate text-xs text-muted-foreground">{workflow.description}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[workflow.status]}>{workflow.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatRelativeTime(workflow.updatedAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(workflow.id)}
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
            <DialogTitle>New workflow</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="New Deal Onboarding" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Runs when a new opportunity is marked closed-won." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="objective"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should the AI step do?</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Summarize the closed-won deal and draft a welcome email."
                        {...field}
                      />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">
                      Creates a single-step draft workflow — add more steps and connect real
                      triggers from the workflow detail page.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createWorkflow.isPending}>
                  Create workflow
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
