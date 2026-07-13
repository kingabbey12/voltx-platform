"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Copy, Key, Plus } from "lucide-react";
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
import {
  useCreatePersonalAccessToken,
  usePersonalAccessTokens,
  useRevokePersonalAccessToken,
} from "@/hooks/use-developer-portal";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { useAuthStore } from "@/lib/stores/auth-store";
import { formatDate } from "@/lib/format";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give this token a name").max(120),
  scopedPermissions: z.string().trim().min(1, "List at least one permission key"),
});
type CreateFormValues = z.infer<typeof createSchema>;

export default function PersonalAccessTokensPage() {
  const { data, isLoading } = usePersonalAccessTokens();
  const createToken = useCreatePersonalAccessToken();
  const revokeToken = useRevokePersonalAccessToken();
  const ownPermissions = useAuthStore((state) => state.user?.permissions ?? []);

  const [createOpen, setCreateOpen] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; name: string } | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", scopedPermissions: "" },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      const result = await createToken.mutateAsync({
        name: values.name,
        scopedPermissions: values.scopedPermissions
          .split(/[\s,]+/)
          .map((key) => key.trim())
          .filter(Boolean),
      });
      setCreatedToken(result.token);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onRevoke() {
    if (!revokeTarget) return;
    try {
      await revokeToken.mutateAsync(revokeTarget.id);
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
          <h2 className="text-base font-semibold">Personal Access Tokens</h2>
          <p className="text-sm text-muted-foreground">
            Bearer tokens for your own scripts — usable in any organization you belong to via the{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-xs">X-Organization-Id</code> header.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create token
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
            icon={Key}
            title="No personal access tokens yet"
            description="Create one to authenticate your own scripts against the Voltx API."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Token</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Last used</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((token) => (
                <TableRow key={token.id}>
                  <TableCell className="font-medium">{token.name}</TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{token.tokenPrefix}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {token.scopedPermissions.slice(0, 3).map((key) => (
                        <Badge key={key} variant="secondary" className="font-mono text-[11px]">
                          {key}
                        </Badge>
                      ))}
                      {token.scopedPermissions.length > 3 && (
                        <Badge variant="secondary">+{token.scopedPermissions.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {token.lastUsedAt ? formatDate(token.lastUsedAt) : "Never"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(token.createdAt)}</TableCell>
                  <TableCell>
                    {!token.revokedAt && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setRevokeTarget({ id: token.id, name: token.name })}
                      >
                        Revoke
                      </Button>
                    )}
                    {token.revokedAt && <Badge variant="destructive">Revoked</Badge>}
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
            setCreatedToken(null);
            setCopied(false);
          }
        }}
      >
        <DialogContent>
          {!createdToken && (
            <>
              <DialogHeader>
                <DialogTitle>Create a personal access token</DialogTitle>
                <DialogDescription>
                  Scope it to only the permissions your script actually needs — you can never grant more
                  than you currently hold ({ownPermissions.length} available).
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
                          <Input placeholder="e.g. Local dev script" {...field} />
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
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" isLoading={createToken.isPending}>
                      Create token
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </>
          )}

          {createdToken && (
            <>
              <DialogHeader>
                <DialogTitle>Token created</DialogTitle>
                <DialogDescription>
                  Copy it now — it&apos;s shown exactly once and can never be retrieved again.
                </DialogDescription>
              </DialogHeader>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
                <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{createdToken}</code>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard.writeText(createdToken);
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
              Any script using this token will immediately start getting 401 Unauthorized. This can&apos;t
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevokeTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onRevoke} isLoading={revokeToken.isPending}>
              Revoke
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
