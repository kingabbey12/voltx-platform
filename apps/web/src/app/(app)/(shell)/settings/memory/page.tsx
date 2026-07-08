"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Brain, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMemory, useDeleteMemory, useMemories } from "@/hooks/use-memory";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";

const CATEGORIES = ["preference", "writing_style", "recurring_task", "context"] as const;

const memorySchema = z.object({
  category: z.enum(CATEGORIES),
  content: z.string().trim().min(1, "Content is required").max(2000),
});
type MemoryFormValues = z.infer<typeof memorySchema>;

const CATEGORY_LABEL: Record<string, string> = {
  preference: "Preference",
  writing_style: "Writing style",
  recurring_task: "Recurring task",
  context: "Context",
};

export default function MemorySettingsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useMemories();
  const createMemory = useCreateMemory();
  const deleteMemory = useDeleteMemory();

  const form = useForm<MemoryFormValues>({
    resolver: zodResolver(memorySchema),
    defaultValues: { category: "preference", content: "" },
  });

  async function onSubmit(values: MemoryFormValues) {
    try {
      await createMemory.mutateAsync(values);
      toast.success("Memory saved");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteMemory.mutateAsync(id);
      toast.success("Memory removed");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-medium">What the AI remembers</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Preferences, writing style, and recurring context the Operator and AI Chat carry into
            future conversations. Real, persisted memory — not simulated.
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add memory
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={Brain}
            title="No memories yet"
            description="Add one manually, or the AI will save relevant context as you use Command Center and AI Chat."
          />
        )}

        {!isLoading &&
          data?.items.map((memory) => (
            <div
              key={memory.id}
              className="flex items-start gap-3 border-b border-border p-4 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{CATEGORY_LABEL[memory.category] ?? memory.category}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(memory.updatedAt)}
                  </span>
                </div>
                <p className="mt-1.5 text-sm">{memory.content}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                onClick={() => onDelete(memory.id)}
                aria-label="Delete memory"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add a memory</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {CATEGORY_LABEL[category]}
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
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What should the AI remember?</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="e.g. Always draft emails in a formal tone."
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createMemory.isPending}>
                  Save memory
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
