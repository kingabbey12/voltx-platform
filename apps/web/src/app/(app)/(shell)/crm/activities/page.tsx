"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CalendarClock, CheckSquare, Mail, MoreHorizontal, Phone, Plus, Sparkles, StickyNote, Trash2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useActivities,
  useActivityMeetingSummary,
  useCreateActivity,
  useDeleteActivity,
} from "@/hooks/use-sales";
import { activitySchema, type ActivityFormValues } from "@/lib/validations/crm";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import type { ActivityType } from "@/lib/api/sales";

const TYPE_VARIANT: Record<ActivityType, "secondary" | "success" | "warning" | "destructive" | "outline"> = {
  CALL: "outline",
  EMAIL: "secondary",
  MEETING: "success",
  TASK: "warning",
  NOTE: "outline",
};
const TYPE_ICON = { CALL: Phone, EMAIL: Mail, MEETING: UsersRound, TASK: CheckSquare, NOTE: StickyNote };
const TYPE_TONE = { CALL: "border-info/20 bg-info/10 text-info", EMAIL: "border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]", MEETING: "border-success/20 bg-success/10 text-success", TASK: "border-warning/20 bg-warning/10 text-warning", NOTE: "border-primary/20 bg-primary/10 text-primary" };

export default function ActivitiesPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [summaryFor, setSummaryFor] = useState<{ id: string; subject: string } | null>(null);
  const { data, isLoading } = useActivities({ limit: 50 });
  const createActivity = useCreateActivity();
  const deleteActivity = useDeleteActivity();
  const meetingSummary = useActivityMeetingSummary();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: { type: "CALL", subject: "", description: "" },
  });

  async function onSubmit(values: ActivityFormValues) {
    try {
      await createActivity.mutateAsync({
        type: values.type,
        subject: values.subject,
        description: values.description || undefined,
      });
      toast.success("Activity logged");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteActivity.mutateAsync(id);
      toast.success("Activity deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleSummarize(id: string, subject: string) {
    setSummaryFor({ id, subject });
    try {
      await meetingSummary.mutateAsync({ id });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
      setSummaryFor(null);
    }
  }

  const activeSummary = data?.items.find((activity) => activity.id === summaryFor?.id);

  return (
    <div className="space-y-5">
      <div className="surface-widget flex flex-col gap-4 rounded-[24px] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-info">Customer pulse</p><p className="mt-1 text-sm text-muted-foreground">{data?.total ?? 0} moments across your customer relationships</p></div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Log activity
        </Button>
      </div>

      <div className="surface-widget overflow-hidden rounded-[24px]">
        {isLoading && (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-20 w-full rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={CalendarClock}
            title="Create a living customer timeline"
            description="Log calls, emails, meetings, and decisions so Voltx can surface the context behind your next move."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Log activity
              </Button>
            }
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <div className="relative space-y-1 p-3 before:absolute before:bottom-6 before:left-8 before:top-6 before:w-px before:bg-white/[0.07]">
              {data.items.map((activity) => {
                const Icon = TYPE_ICON[activity.type];
                return <article key={activity.id} className="group relative flex gap-4 rounded-2xl p-3 transition-colors hover:bg-white/[0.035]">
                  <span className={`relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-2xl border shadow-[0_10px_22px_-16px_currentColor] ${TYPE_TONE[activity.type]}`}><Icon className="h-4 w-4" /></span>
                  <div className="min-w-0 flex-1 pt-0.5"><p className="truncate text-sm font-semibold tracking-tight">{activity.subject}</p>{activity.description && <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{activity.description}</p>}<div className="mt-2 flex items-center gap-2"><Badge variant={TYPE_VARIANT[activity.type]}>{activity.type}</Badge><span className="text-[11px] text-muted-foreground">{formatRelativeTime(activity.occurredAt ?? activity.createdAt)}</span>{activity.meetingSummary && <span className="inline-flex items-center gap-1 text-[11px] text-[hsl(268_83%_76%)]"><Sparkles className="h-3 w-3" />AI summary ready</span>}</div></div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {activity.type === "MEETING" && (
                          <DropdownMenuItem onClick={() => handleSummarize(activity.id, activity.subject)}>
                            <Sparkles className="h-4 w-4" />
                            {activity.meetingSummary ? "View AI summary" : "AI summarize"}
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(activity.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </article>;
                })}
            </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log activity</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CALL">Call</SelectItem>
                        <SelectItem value="EMAIL">Email</SelectItem>
                        <SelectItem value="MEETING">Meeting</SelectItem>
                        <SelectItem value="TASK">Task</SelectItem>
                        <SelectItem value="NOTE">Note</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Discovery call with Acme Inc." autoFocus {...field} />
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
                    <FormLabel>Notes (optional)</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createActivity.isPending}>
                  Log activity
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={summaryFor !== null} onOpenChange={(open) => !open && setSummaryFor(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              {summaryFor?.subject}
            </DialogTitle>
          </DialogHeader>
          {meetingSummary.isPending && !activeSummary?.meetingSummary ? (
            <div className="h-24 animate-pulse rounded-lg bg-secondary/60" />
          ) : (
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-secondary/40 p-4 text-sm">
              {activeSummary?.meetingSummary ?? "No summary yet."}
            </p>
          )}
        </DialogContent>
      </Dialog>

      <p className="mt-4 text-xs text-muted-foreground">
        Activities linked to a specific company, contact, lead, or opportunity also appear on that
        record&apos;s page. <Link href="/crm/companies" className="hover:text-foreground">Browse companies</Link>
      </p>
    </div>
  );
}
