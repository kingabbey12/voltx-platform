"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Copy, ListTree, Plus, RefreshCw, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateOAuthApplication,
  useDeleteOAuthApplication,
  useOAuthApplications,
  useRotateOAuthApplicationSecret,
  useSetOAuthApplicationStatus,
  useUpdateOAuthApplication,
} from "@/hooks/use-developer-portal";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { OAuthApplication } from "@/lib/api/developer-portal";
import { formatDate } from "@/lib/format";

const formSchema = z.object({
  name: z.string().trim().min(1, "Give this app a name").max(120),
  description: z.string().trim().max(1000).optional(),
  redirectUris: z.string().trim().min(1, "At least one redirect URI is required"),
  scopes: z.string().trim().min(1, "List at least one permission key"),
});
type FormValues = z.infer<typeof formSchema>;

const STATUS_VARIANT: Record<string, "success" | "destructive"> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
};

function parseLines(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function OAuthApplicationsPage() {
  const { data, isLoading } = useOAuthApplications();
  const createApp = useCreateOAuthApplication();
  const updateApp = useUpdateOAuthApplication();
  const rotateSecret = useRotateOAuthApplicationSecret();
  const setStatus = useSetOAuthApplicationStatus();
  const deleteApp = useDeleteOAuthApplication();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<OAuthApplication | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ appName: string; secret: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OAuthApplication | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", redirectUris: "", scopes: "" },
  });

  function openCreate() {
    form.reset({ name: "", description: "", redirectUris: "", scopes: "" });
    setDialogMode("create");
  }

  function openEdit(app: OAuthApplication) {
    setEditing(app);
    form.reset({
      name: app.name,
      description: app.description ?? "",
      redirectUris: app.redirectUris.join("\n"),
      scopes: app.scopes.join(" "),
    });
    setDialogMode("edit");
  }

  async function onSubmit(values: FormValues) {
    const redirectUris = parseLines(values.redirectUris);
    const scopes = parseLines(values.scopes);
    try {
      if (dialogMode === "edit" && editing) {
        await updateApp.mutateAsync({
          id: editing.id,
          input: { name: values.name, description: values.description, redirectUris, scopes },
        });
        toast.success(`Updated "${values.name}"`);
        setDialogMode(null);
      } else {
        const result = await createApp.mutateAsync({
          name: values.name,
          description: values.description,
          redirectUris,
          scopes,
        });
        setRevealedSecret({ appName: result.name, secret: result.clientSecret });
        setDialogMode(null);
      }
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onRotateSecret(app: OAuthApplication) {
    try {
      const result = await rotateSecret.mutateAsync(app.id);
      setRevealedSecret({ appName: app.name, secret: result.clientSecret });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onToggleStatus(app: OAuthApplication) {
    try {
      await setStatus.mutateAsync({ id: app.id, action: app.status === "ACTIVE" ? "suspend" : "reactivate" });
      toast.success(app.status === "ACTIVE" ? `Suspended "${app.name}"` : `Reactivated "${app.name}"`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteApp.mutateAsync(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">OAuth Applications</h2>
          <p className="text-sm text-muted-foreground">
            Register a third-party app to authorize on a user&apos;s behalf via OAuth 2.0
            (authorization_code + PKCE).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Register application
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
            icon={ListTree}
            title="No OAuth applications yet"
            description="Register one to let a third-party app request access on behalf of your users."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Client ID</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-64" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((app) => (
                <TableRow key={app.id}>
                  <TableCell>
                    <div className="font-medium">{app.name}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(app.createdAt)}</div>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-muted-foreground">{app.clientId}</code>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {app.scopes.slice(0, 2).map((key) => (
                        <Badge key={key} variant="secondary" className="font-mono text-[11px]">
                          {key}
                        </Badge>
                      ))}
                      {app.scopes.length > 2 && <Badge variant="secondary">+{app.scopes.length - 2}</Badge>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[app.status]}>{app.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEdit(app)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onRotateSecret(app)}>
                        <RefreshCw className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onToggleStatus(app)}>
                        {app.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(app)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogMode !== null} onOpenChange={(open) => !open && setDialogMode(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{dialogMode === "edit" ? "Edit application" : "Register an OAuth application"}</DialogTitle>
            <DialogDescription>
              Redirect URIs must be https (loopback http is allowed for local development). Scopes can
              never exceed your own current permissions.
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
                      <Input placeholder="e.g. Acme Reporting" {...field} />
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
                      <Textarea placeholder="Syncs Voltx sales activity into Acme dashboards" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="redirectUris"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Redirect URIs</FormLabel>
                    <FormControl>
                      <Textarea placeholder={"https://acme.example/oauth/callback"} {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">One per line.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="scopes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scopes</FormLabel>
                    <FormControl>
                      <Input placeholder="sales.opportunity.read sales.contact.read" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">Space-separated permission keys.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createApp.isPending || updateApp.isPending}>
                  {dialogMode === "edit" ? "Save changes" : "Register"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={revealedSecret !== null} onOpenChange={(open) => !open && setRevealedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Client secret for &quot;{revealedSecret?.appName}&quot;</DialogTitle>
            <DialogDescription>
              Copy it now — it&apos;s shown exactly once and can never be retrieved again.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">
              {revealedSecret?.secret}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!revealedSecret) return;
                void navigator.clipboard.writeText(revealedSecret.secret);
                setCopied(true);
                toast.success("Copied to clipboard");
              }}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setRevealedSecret(null);
                setCopied(false);
              }}
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete &quot;{deleteTarget?.name}&quot;?</DialogTitle>
            <DialogDescription>
              This revokes every authorization code and token this app ever issued. This can&apos;t be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} isLoading={deleteApp.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
