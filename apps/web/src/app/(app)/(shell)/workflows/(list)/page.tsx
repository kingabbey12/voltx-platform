"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  ArrowUpRight,
  ChevronRight,
  CircleAlert,
  FilePenLine,
  MoreHorizontal,
  PlayCircle,
  Plus,
  Trash2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
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

  const workflows = data?.items ?? [];
  const publishedCount = workflows.filter((workflow) => workflow.status === "PUBLISHED").length;
  const draftCount = workflows.filter((workflow) => workflow.status === "DRAFT").length;
  const archivedCount = workflows.filter((workflow) => workflow.status === "ARCHIVED").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workflows"
        description="Build, review, and safely run the automations that move work through Voltx."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New workflow
          </Button>
        }
      />

      <section aria-label="Workflow overview" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "All workflows", value: workflows.length, icon: WorkflowIcon, tone: "text-primary" },
          { label: "Active", value: publishedCount, icon: PlayCircle, tone: "text-emerald-500" },
          { label: "Drafts", value: draftCount, icon: FilePenLine, tone: "text-amber-500" },
          { label: "Archived", value: archivedCount, icon: CircleAlert, tone: "text-muted-foreground" },
        ].map((stat) => (
          <div key={stat.label} className="surface-widget min-h-28 rounded-xl p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
              <stat.icon className={`h-4 w-4 ${stat.tone}`} aria-hidden />
            </div>
            <p className="mt-3 text-2xl font-semibold tabular-nums">{isLoading ? "-" : stat.value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="workflow-directory-heading" className="surface-raised overflow-hidden rounded-xl">
        <div className="flex flex-col gap-3 border-b border-border/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 id="workflow-directory-heading" className="text-sm font-semibold">Automation directory</h2>
            <p className="mt-1 text-xs text-muted-foreground">Open a workflow to review its builder, run history, and approval state.</p>
          </div>
          {draftCount > 0 && (
            <Badge variant="secondary" className="w-fit">
              <FilePenLine className="h-3.5 w-3.5" />
              {draftCount} draft{draftCount === 1 ? "" : "s"} need review
            </Badge>
          )}
        </div>

        {isLoading && (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {[1, 2, 3, 4].map((index) => (
              <div key={index} className="h-44 animate-pulse rounded-lg border border-border/70 bg-secondary/40" />
            ))}
          </div>
        )}

        {!isLoading && workflows.length === 0 && (
          <EmptyState
            icon={WorkflowIcon}
            title="Build your first automation"
            description="Start with a draft AI Agent step, then add supported tool, integration, notification, approval, delay, loop, or branching steps in the visual builder."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New workflow
              </Button>
            }
            className="m-4 border border-dashed border-border/80 bg-secondary/20"
          />
        )}

        {!isLoading && workflows.length > 0 && (
          <div className="grid gap-3 p-4 lg:grid-cols-2">
            {workflows.map((workflow) => (
              <article key={workflow.id} className="group rounded-lg border border-border/80 bg-card/60 p-4 transition-colors hover:border-primary/35 hover:bg-secondary/30">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-semibold">{workflow.name}</h3>
                      <Badge variant={STATUS_VARIANT[workflow.status]}>{workflow.status === "PUBLISHED" ? "Active" : workflow.status}</Badge>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground">
                      {workflow.description || "No description has been added to this workflow."}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`More options for ${workflow.name}`}>
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
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
                  <span className="text-xs text-muted-foreground">Updated {formatRelativeTime(workflow.updatedAt)}</span>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="sm" onClick={() => router.push(`/workflows/${workflow.id}`)}>
                      Details
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" onClick={() => router.push(`/workflows/${workflow.id}/builder`)}>
                      Open builder
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

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
