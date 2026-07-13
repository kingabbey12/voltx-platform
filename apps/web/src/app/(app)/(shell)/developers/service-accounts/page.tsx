"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Copy, Plus, ShieldCheck } from "lucide-react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateServiceAccount,
  useCreateServiceAccountToken,
  useRevokeServiceAccountToken,
  useServiceAccountTokens,
  useServiceAccounts,
  useSetServiceAccountStatus,
} from "@/hooks/use-developer-portal";
import { useRoles } from "@/hooks/use-invitations";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { ServiceAccount } from "@/lib/api/developer-portal";
import { formatDate } from "@/lib/format";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give this service account a name").max(120),
  description: z.string().trim().max(1000).optional(),
  roleId: z.string().min(1, "Choose a role"),
});
type CreateFormValues = z.infer<typeof createSchema>;

const tokenSchema = z.object({ name: z.string().trim().min(1, "Give this token a name").max(120) });
type TokenFormValues = z.infer<typeof tokenSchema>;

const STATUS_VARIANT: Record<string, "success" | "destructive"> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
};

export default function ServiceAccountsPage() {
  const { data, isLoading } = useServiceAccounts();
  const { data: rolesData } = useRoles();
  const createAccount = useCreateServiceAccount();
  const setStatus = useSetServiceAccountStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [managingAccount, setManagingAccount] = useState<ServiceAccount | null>(null);

  const form = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: "", description: "", roleId: "" },
  });

  async function onSubmit(values: CreateFormValues) {
    try {
      await createAccount.mutateAsync(values);
      toast.success(`Created "${values.name}"`);
      setCreateOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onToggleStatus(account: ServiceAccount) {
    try {
      await setStatus.mutateAsync({
        id: account.id,
        action: account.status === "ACTIVE" ? "suspend" : "reactivate",
      });
      toast.success(account.status === "ACTIVE" ? `Suspended "${account.name}"` : `Reactivated "${account.name}"`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Service Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Machine identities for CI/CD pipelines and background integrations — each holds a real
            organization role.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          Create service account
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
            icon={ShieldCheck}
            title="No service accounts yet"
            description="Create one to give a CI pipeline or integration its own scoped identity."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-56" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>
                    <div className="font-medium">{account.name}</div>
                    {account.description && (
                      <div className="text-xs text-muted-foreground">{account.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[account.status]}>{account.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(account.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setManagingAccount(account)}>
                        Manage tokens
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onToggleStatus(account)}>
                        {account.status === "ACTIVE" ? "Suspend" : "Reactivate"}
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
            <DialogTitle>Create a service account</DialogTitle>
            <DialogDescription>
              You can only grant a role with permissions you currently hold yourself.
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
                      <Input placeholder="e.g. CI Pipeline" {...field} />
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
                      <Textarea placeholder="Deploys workflows from the release pipeline" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {rolesData?.items.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
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
                <Button type="submit" isLoading={createAccount.isPending}>
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <ManageTokensDialog account={managingAccount} onClose={() => setManagingAccount(null)} />
    </div>
  );
}

function ManageTokensDialog({
  account,
  onClose,
}: {
  account: ServiceAccount | null;
  onClose: () => void;
}) {
  const { data: tokens, isLoading } = useServiceAccountTokens(account?.id ?? null);
  const createToken = useCreateServiceAccountToken();
  const revokeToken = useRevokeServiceAccountToken();
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const form = useForm<TokenFormValues>({
    resolver: zodResolver(tokenSchema),
    defaultValues: { name: "" },
  });

  async function onSubmit(values: TokenFormValues) {
    if (!account) return;
    try {
      const result = await createToken.mutateAsync({ serviceAccountId: account.id, input: values });
      setCreatedToken(result.token);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onRevoke(tokenId: string) {
    if (!account) return;
    try {
      await revokeToken.mutateAsync({ serviceAccountId: account.id, tokenId });
      toast.success("Token revoked");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <Dialog
      open={account !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
          setCreatedToken(null);
          setCopied(false);
          form.reset();
        }
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Tokens for &quot;{account?.name}&quot;</DialogTitle>
          <DialogDescription>
            Authenticate as this service account via the{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-xs">X-Service-Account-Token</code>{" "}
            header.
          </DialogDescription>
        </DialogHeader>

        {createdToken ? (
          <div className="flex flex-col gap-4">
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
            <p className="text-xs text-muted-foreground">
              Shown exactly once — copy it now, it can never be retrieved again.
            </p>
            <DialogFooter>
              <Button onClick={() => setCreatedToken(null)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            {isLoading && <div className="h-10 animate-pulse rounded-lg bg-secondary/60" />}
            {!isLoading && tokens && tokens.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Token</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tokens.map((token) => (
                    <TableRow key={token.id}>
                      <TableCell>{token.name}</TableCell>
                      <TableCell>
                        <code className="text-xs text-muted-foreground">{token.tokenPrefix}</code>
                      </TableCell>
                      <TableCell>
                        {!token.revokedAt ? (
                          <Button size="sm" variant="outline" onClick={() => onRevoke(token.id)}>
                            Revoke
                          </Button>
                        ) : (
                          <Badge variant="destructive">Revoked</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 flex items-end gap-2">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormLabel>New token name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Production token" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" isLoading={createToken.isPending}>
                  Issue token
                </Button>
              </form>
            </Form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
