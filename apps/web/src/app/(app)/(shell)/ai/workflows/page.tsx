"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  BarChart3,
  CircleDashed,
  Copy,
  GripVertical,
  MousePointerClick,
  Plus,
  Search,
  Trash2,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import {
  useCreateWorkflow,
  useDeleteWorkflow,
  useWorkflows,
} from "@/hooks/use-workflows";
import { WorkflowStatusBadge } from "@/components/ai-workflows/status-badges";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import type { WorkflowStatus as WfStatus } from "@/lib/api/workflows";

const createSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(150),
  description: z.string().trim().max(1000).optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

export default function AiWorkflowsListPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<WfStatus | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "" },
  });

  const workflows = data?.items ?? [];

  const filtered = workflows.filter((w) => {
    if (statusFilter !== "ALL" && w.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!w.name.toLowerCase().includes(q)) {
        if (!w.description?.toLowerCase().includes(q)) return false;
      }
    }
    return true;
  });

  async function onCreate(values: CreateFormValues) {
    try {
      const wf = await createWorkflow.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        definition: { steps: [] },
      });
      toast.success("Workflow created as draft");
      setDialogOpen(false);
      form.reset();
      router.push(`/ai/workflows/${wf.id}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this workflow permanently?")) return;
    try {
      await deleteWorkflow.mutateAsync(id);
      toast.success("Workflow deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function handleClone(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const wf = workflows.find((w) => w.id === id);
    if (!wf) return;
    createWorkflow.mutate(
      {
        name: `${wf.name} (copy)`,
        description: wf.description ?? undefined,
        definition: { steps: [] },
      },
      {
        onSuccess: (created) => {
          toast.success("Workflow cloned");
          router.push(`/ai/workflows/${created.id}`);
        },
        onError: (err) => toast.error(friendlyErrorMessage(err)),
      },
    );
  }

  const total = workflows.length;
  const published = workflows.filter((w) => w.status === "PUBLISHED").length;
  const draft = workflows.filter((w) => w.status === "DRAFT").length;

  return (
    <div>
      <PageHeader
        title="AI Workflows"
        description="Create and manage multi-step AI-automated workflows."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            New Workflow
          </Button>
        }
      />

      {/* Analytics summary */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Total</CardTitle>
            <Workflow className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{total}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Published</CardTitle>
            <MousePointerClick className="h-3.5 w-3.5 text-emerald-500" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{published}</CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Drafts</CardTitle>
            <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="text-2xl font-semibold tabular-nums">{draft}</CardContent>
        </Card>
      </div>

      {/* Search + Filter */}
      <div className="mt-6 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search workflows…"
            className="pl-8 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as WfStatus | "ALL")}
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="PUBLISHED">Published</SelectItem>
            <SelectItem value="ARCHIVED">Archived</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <EmptyState
            icon={Workflow}
            title={search || statusFilter !== "ALL" ? "No matching workflows" : "No workflows yet"}
            description={
              search || statusFilter !== "ALL"
                ? "Try a different search or filter."
                : "Create your first automated workflow with AI steps."
            }
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                New Workflow
              </Button>
            }
          />
        )}

        {!isLoading && filtered.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((workflow) => (
                <TableRow
                  key={workflow.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/ai/workflows/${workflow.id}`)}
                >
                  <TableCell>
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </TableCell>
                  <TableCell>
                    <p className="font-medium">{workflow.name}</p>
                    {workflow.description && (
                      <p className="truncate text-xs text-muted-foreground max-w-md">
                        {workflow.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <WorkflowStatusBadge status={workflow.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatRelativeTime(workflow.updatedAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <BarChart3 className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/ai/workflows/${workflow.id}/edit`)}>
                          <Workflow className="h-4 w-4" />
                          Open builder
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push(`/ai/workflows/${workflow.id}`)}>
                          <BarChart3 className="h-4 w-4" />
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleClone(workflow.id, e)}>
                          <Copy className="h-4 w-4" />
                          Clone
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={(e) => handleDelete(workflow.id, e)}
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New workflow</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onCreate)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Lead Qualification Pipeline" autoFocus {...field} />
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
                      <Input placeholder="Qualifies inbound leads using AI scoring." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createWorkflow.isPending}>
                  Create draft
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
