"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Archive, Plus } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  useCreateRetentionPolicy,
  useDeleteRetentionPolicy,
  useRetentionPolicies,
  useUpdateRetentionPolicy,
} from "@/hooks/use-compliance";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { RetentionPolicy } from "@/lib/api/compliance";

const RESOURCE_LABELS: Record<string, string> = {
  AUDIT_LOG: "Audit log",
  CONVERSATION: "Conversation",
  NOTIFICATION: "Notification",
  ATTACHMENT: "Attachment",
};

const createSchema = z.object({
  resourceType: z.enum(["AUDIT_LOG", "CONVERSATION", "NOTIFICATION", "ATTACHMENT"]),
  retentionDays: z.coerce.number().int().min(1),
  action: z.enum(["DELETE", "ANONYMIZE"]),
});
type CreateFormValues = z.infer<typeof createSchema>;

export default function RetentionPoliciesPage() {
  const { data, isLoading } = useRetentionPolicies();
  const createPolicy = useCreateRetentionPolicy();
  const updatePolicy = useUpdateRetentionPolicy();
  const deletePolicy = useDeleteRetentionPolicy();

  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<RetentionPolicy | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { resourceType: "AUDIT_LOG", retentionDays: 90, action: "DELETE" },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      await createPolicy.mutateAsync(values);
      toast.success("Retention policy created");
      setCreateOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onToggleActive(policy: RetentionPolicy) {
    try {
      await updatePolicy.mutateAsync({ id: policy.id, input: { isActive: !policy.isActive } });
      toast.success(policy.isActive ? "Policy disabled" : "Policy enabled");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deletePolicy.mutateAsync(deleteTarget.id);
      toast.success("Retention policy deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Retention policies</h2>
          <p className="text-sm text-muted-foreground">
            How long each resource type is kept before it&apos;s automatically deleted or anonymized. One
            policy per resource type.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Add policy
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
            icon={Archive}
            title="No retention policies"
            description="Add a policy to automatically clean up data on a schedule."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Retention</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((policy) => (
                <TableRow key={policy.id}>
                  <TableCell className="font-medium">
                    {RESOURCE_LABELS[policy.resourceType] ?? policy.resourceType}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{policy.retentionDays} days</TableCell>
                  <TableCell>
                    <Badge variant={policy.action === "DELETE" ? "destructive" : "info"}>
                      {policy.action}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch checked={policy.isActive} onCheckedChange={() => onToggleActive(policy)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(policy)}>
                        Delete
                      </Button>
                    </div>
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
            <DialogTitle>Add a retention policy</DialogTitle>
            <DialogDescription>
              Only one active policy is allowed per resource type.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="resourceType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Resource type</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.entries(RESOURCE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
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
                name="retentionDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Retention (days)</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="action"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Action on expiry</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="DELETE">Delete</SelectItem>
                        <SelectItem value="ANONYMIZE">Anonymize</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createPolicy.isPending}>
                  Add policy
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Delete retention policy for &quot;
              {deleteTarget ? RESOURCE_LABELS[deleteTarget.resourceType] ?? deleteTarget.resourceType : ""}
              &quot;?
            </DialogTitle>
            <DialogDescription>
              That resource type will no longer be automatically cleaned up. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} isLoading={deletePolicy.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
