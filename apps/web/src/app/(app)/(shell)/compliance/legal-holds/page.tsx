"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Gavel, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useCreateLegalHold, useLegalHolds, useReleaseLegalHold } from "@/hooks/use-compliance";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";

const createSchema = z.object({
  name: z.string().trim().min(1, "Required").max(160),
  reason: z.string().trim().min(1, "Required").max(2000),
  targetUserId: z.string().trim().optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

export default function LegalHoldsPage() {
  const { data, isLoading } = useLegalHolds();
  const createHold = useCreateLegalHold();
  const releaseHold = useReleaseLegalHold();

  const [createOpen, setCreateOpen] = useState(false);
  const [releaseTarget, setReleaseTarget] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", reason: "", targetUserId: "" },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      await createHold.mutateAsync({
        name: values.name,
        reason: values.reason,
        targetUserId: values.targetUserId?.trim() || undefined,
      });
      toast.success("Legal hold created");
      setCreateOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onRelease() {
    if (!releaseTarget) return;
    try {
      await releaseHold.mutateAsync(releaseTarget.id);
      toast.success(`Released "${releaseTarget.name}"`);
      setReleaseTarget(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Legal holds</h2>
          <p className="text-sm text-muted-foreground">
            Preserves data from deletion/anonymization for a specific user, or organization-wide, for
            legal or investigative purposes.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Place hold
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <EmptyState
            icon={Gavel}
            title="No legal holds"
            description="Place a hold to prevent a user's data — or the whole organization's — from being deleted."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((hold) => (
                <TableRow key={hold.id}>
                  <TableCell>
                    <p className="font-medium text-foreground">{hold.name}</p>
                    <p className="max-w-xs truncate text-xs text-muted-foreground">{hold.reason}</p>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {hold.targetUserId ?? "Organization-wide"}
                  </TableCell>
                  <TableCell>
                    {hold.status === "ACTIVE" ? (
                      <Badge variant="warning">Active</Badge>
                    ) : (
                      <Badge variant="secondary">Released</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(hold.createdAt)}</TableCell>
                  <TableCell>
                    {hold.status === "ACTIVE" && (
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setReleaseTarget({ id: hold.id, name: hold.name })}
                        >
                          Release
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) form.reset();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place a legal hold</DialogTitle>
            <DialogDescription>
              Leave the user ID empty to place an organization-wide hold covering every user.
            </DialogDescription>
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
                      <Input placeholder="e.g. Smith v. Acme litigation" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Active litigation hold requested by legal counsel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="targetUserId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target user ID (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Leave empty for organization-wide" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createHold.isPending}>
                  Place hold
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={releaseTarget !== null} onOpenChange={(open) => !open && setReleaseTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Release &quot;{releaseTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>
              Data covered by this hold becomes eligible for normal deletion/anonymization again. This
              can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReleaseTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRelease} isLoading={releaseHold.isPending}>
              Release hold
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
