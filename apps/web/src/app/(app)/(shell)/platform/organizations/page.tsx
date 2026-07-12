"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Building2, LogIn, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useStartImpersonation } from "@/hooks/use-platform";
import { usePlatformOrganizations } from "@/hooks/use-platform";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { PlatformOrganizationSummary } from "@/lib/api/platform";
import { formatDate } from "@/lib/format";

const impersonateSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(10, "Give a specific reason (at least 10 characters) — it's recorded on the audit trail"),
});
type ImpersonateFormValues = z.infer<typeof impersonateSchema>;

const STATUS_VARIANT: Record<string, "success" | "secondary" | "destructive"> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
};

export default function PlatformOrganizationsPage() {
  const [search, setSearch] = useState("");
  const [target, setTarget] = useState<PlatformOrganizationSummary | null>(null);
  const router = useRouter();
  const { data, isLoading } = usePlatformOrganizations({ search: search || undefined, limit: 20 });
  const startImpersonation = useStartImpersonation();

  const form = useForm<ImpersonateFormValues>({
    resolver: zodResolver(impersonateSchema),
    defaultValues: { reason: "" },
  });

  async function onSubmit(values: ImpersonateFormValues) {
    if (!target) return;
    try {
      await startImpersonation.mutateAsync({
        targetOrganizationId: target.id,
        organizationName: target.name,
        reason: values.reason,
      });
      toast.success(`Impersonating ${target.name}`);
      setTarget(null);
      form.reset();
      router.push("/dashboard");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Organizations</h1>
          <p className="text-sm text-muted-foreground">
            Search every organization on the platform and start a support session when needed.
          </p>
        </div>
      </div>

      <div className="relative mt-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by name or slug…"
          className="pl-9"
        />
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState icon={Building2} title="No organizations found" description="Try a different search." />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Organization</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Members</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((org) => (
                <TableRow key={org.id}>
                  <TableCell>
                    <div className="font-medium">{org.name}</div>
                    <div className="text-xs text-muted-foreground">{org.slug}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[org.status] ?? "secondary"}>{org.status}</Badge>
                  </TableCell>
                  <TableCell>{org.memberCount}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(org.createdAt)}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" onClick={() => setTarget(org)}>
                      <LogIn className="h-3.5 w-3.5" />
                      Impersonate
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={target !== null}
        onOpenChange={(open) => {
          if (!open) {
            setTarget(null);
            form.reset();
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate {target?.name}</DialogTitle>
            <DialogDescription>
              You&apos;ll see exactly what this organization&apos;s own admin sees. Every action is
              attributed to you and recorded on the audit trail with this reason.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g. Investigating a customer-reported billing discrepancy"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTarget(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={startImpersonation.isPending}>
                  Start impersonation
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
