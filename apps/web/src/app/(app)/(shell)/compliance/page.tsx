"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FileCheck2, Plus } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useConsentRecords, useCreateConsentRecord } from "@/hooks/use-compliance";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";

const createSchema = z.object({
  userId: z.string().trim().uuid("Must be a valid user ID (UUID)"),
  consentType: z.string().trim().min(1, "Required").max(120),
  granted: z.boolean(),
});
type CreateFormValues = z.infer<typeof createSchema>;

export default function ConsentRecordsPage() {
  const { data, isLoading } = useConsentRecords();
  const createRecord = useCreateConsentRecord();
  const [createOpen, setCreateOpen] = useState(false);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { userId: "", consentType: "", granted: true },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      await createRecord.mutateAsync(values);
      toast.success("Consent record logged");
      setCreateOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Consent records</h2>
          <p className="text-sm text-muted-foreground">
            Append-only history of what each user has consented to. To revoke, log a new record with
            consent unchecked.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Log consent
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.length === 0 && (
          <EmptyState
            icon={FileCheck2}
            title="No consent records yet"
            description="Log the first consent decision for a user."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Consent type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Logged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{record.userId}</TableCell>
                  <TableCell className="font-medium">{record.consentType}</TableCell>
                  <TableCell>
                    {record.granted ? (
                      <Badge variant="success">Granted</Badge>
                    ) : (
                      <Badge variant="destructive">Revoked</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(record.createdAt)}</TableCell>
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
            <DialogTitle>Log a consent record</DialogTitle>
            <DialogDescription>
              Records the user&apos;s current consent decision. History is append-only and never edited.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="userId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID</FormLabel>
                    <FormControl>
                      <Input placeholder="uuid" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="consentType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Consent type</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. marketing_emails" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="granted"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-4">
                    <FormLabel className="!mt-0">Consent granted</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createRecord.isPending}>
                  Log record
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
