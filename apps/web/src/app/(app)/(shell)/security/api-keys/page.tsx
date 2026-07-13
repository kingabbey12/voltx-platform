"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Copy, KeyRound, Plus } from "lucide-react";
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
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/hooks/use-security";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate } from "@/lib/format";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give this key a name").max(120),
  scopedPermissions: z.string().trim().min(1, "List at least one permission key"),
  expiresAt: z.string().optional(),
});
type CreateFormValues = z.infer<typeof createSchema>;

export default function ApiKeysPage() {
  const { data, isLoading } = useApiKeys();
  const createKey = useCreateApiKey();
  const revokeKey = useRevokeApiKey();
  const ownPermissions = useAuthStore((state) => state.user?.permissions ?? []);

  const [createOpen, setCreateOpen] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", scopedPermissions: "", expiresAt: "" },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      const result = await createKey.mutateAsync({
        name: values.name,
        scopedPermissions: values.scopedPermissions
          .split(/[\s,]+/)
          .map((key) => key.trim())
          .filter(Boolean),
        expiresAt: values.expiresAt ? new Date(values.expiresAt).toISOString() : undefined,
      });
      setCreatedKey(result.apiKey);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onRevoke() {
    if (!revokeTarget) return;
    try {
      await revokeKey.mutateAsync(revokeTarget.id);
      toast.success(`Revoked "${revokeTarget.name}"`);
      setRevokeTarget(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">API keys</h2>
          <p className="text-sm text-muted-foreground">
            Organization-wide keys for server-to-server integrations against the Voltx API.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create key
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
            icon={KeyRound}
            title="No API keys yet"
            description="Create one to authenticate server-to-server calls against the Voltx API."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((key) => (
                <TableRow key={key.id}>
                  <TableCell className="font-medium">{key.name}</TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{key.keyPrefix}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {key.scopedPermissions.slice(0, 3).map((permission) => (
                        <Badge key={permission} variant="secondary" className="font-mono text-[11px]">
                          {permission}
                        </Badge>
                      ))}
                      {key.scopedPermissions.length > 3 && (
                        <Badge variant="secondary">+{key.scopedPermissions.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.expiresAt ? formatDate(key.expiresAt) : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    {!key.revokedAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRevokeTarget({ id: key.id, name: key.name })}
                      >
                        Revoke
                      </Button>
                    )}
                    {key.revokedAt && <Badge variant="destructive">Revoked</Badge>}
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
          if (!open) {
            form.reset();
            setCreatedKey(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          {!createdKey && (
            <>
              <DialogHeader>
                <DialogTitle>Create an API key</DialogTitle>
                <DialogDescription>
                  Scope it to only the permissions this integration needs — you can never grant more than
                  you currently hold ({ownPermissions.length} available).
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
                          <Input placeholder="e.g. Order sync service" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="scopedPermissions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Permission keys</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. sales.opportunity.read sales.contact.read" {...field} />
                        </FormControl>
                        <p className="text-xs text-muted-foreground">Space or comma-separated.</p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="expiresAt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expiration (optional)</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={createKey.isPending}>
                      Create key
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}

          {createdKey && (
            <>
              <DialogHeader>
                <DialogTitle>Key created</DialogTitle>
                <DialogDescription>
                  Copy it now — it&apos;s shown exactly once and can never be retrieved again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{createdKey}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdKey);
                    setCopied(true);
                    toast.success("Copied to clipboard");
                  }}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setCreateOpen(false)}>Done</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={revokeTarget !== null} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revoke &quot;{revokeTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>
              Any integration using this key will immediately start getting 401 Unauthorized. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRevoke} isLoading={revokeKey.isPending}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
