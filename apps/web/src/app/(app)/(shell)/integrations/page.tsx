"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { HeartPulse, Link2, Plug, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/layout/page-header";
import {
  useCreateApiKeyConnection,
  useDeleteConnection,
  useHealthCheckConnection,
  useIntegrations,
  useSyncConnection,
} from "@/hooks/use-integrations";
import { API_KEY_PROVIDER_KEYS, OAUTH_PROVIDER_KEYS } from "@/lib/api/integrations";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";

const connectSchema = z.object({
  provider: z.enum(API_KEY_PROVIDER_KEYS),
  displayName: z.string().trim().min(1, "Display name is required").max(150),
  apiKey: z.string().trim().optional(),
  webhookSecret: z.string().trim().optional(),
});
type ConnectFormValues = z.infer<typeof connectSchema>;

function providerLabel(key: string): string {
  return key
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

export default function IntegrationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useIntegrations();
  const createConnection = useCreateApiKeyConnection();
  const healthCheck = useHealthCheckConnection();
  const sync = useSyncConnection();
  const deleteConnection = useDeleteConnection();

  const form = useForm<ConnectFormValues>({
    resolver: zodResolver(connectSchema),
    defaultValues: { provider: API_KEY_PROVIDER_KEYS[0], displayName: "", apiKey: "", webhookSecret: "" },
  });

  async function onSubmit(values: ConnectFormValues) {
    try {
      await createConnection.mutateAsync({
        provider: values.provider,
        displayName: values.displayName,
        apiKey: values.apiKey || undefined,
        webhookSecret: values.webhookSecret || undefined,
      });
      toast.success("Integration connected");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  const connectedOAuthProviders = new Set(
    data?.items.filter((c) => c.status === "CONNECTED").map((c) => c.provider),
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <PageHeader
        title="Integrations"
        description="Connect the tools your business runs on."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plug className="h-4 w-4" />
            Connect
          </Button>
        }
      />

      <div className="mt-6">
        <h2 className="text-sm font-medium text-muted-foreground">Your connections</h2>
        <div className="mt-2 rounded-xl border border-border">
          {isLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}
          {!isLoading && data?.items.length === 0 && (
            <EmptyState
              icon={Plug}
              title="No integrations connected"
              description="Connect Stripe, a webhook, or a REST API to start automating with real data."
            />
          )}
          {!isLoading &&
            data?.items.map((connection) => (
              <div
                key={connection.id}
                className="flex items-center gap-3 border-b border-border p-4 last:border-b-0"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Link2 className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{connection.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {providerLabel(connection.provider)} &bull;{" "}
                    {connection.lastSyncAt ? `synced ${formatRelativeTime(connection.lastSyncAt)}` : "never synced"}
                  </p>
                </div>
                <Badge variant={connection.status === "CONNECTED" ? "success" : "secondary"}>
                  {connection.status}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={async () => {
                    try {
                      await healthCheck.mutateAsync(connection.id);
                      toast.success("Health check complete");
                    } catch (error) {
                      toast.error(friendlyErrorMessage(error));
                    }
                  }}
                  aria-label="Health check"
                >
                  <HeartPulse className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={async () => {
                    try {
                      await sync.mutateAsync(connection.id);
                      toast.success("Sync started");
                    } catch (error) {
                      toast.error(friendlyErrorMessage(error));
                    }
                  }}
                  aria-label="Sync now"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={async () => {
                    try {
                      await deleteConnection.mutateAsync(connection.id);
                      toast.success("Connection removed");
                    } catch (error) {
                      toast.error(friendlyErrorMessage(error));
                    }
                  }}
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground">Available via secure web sign-in</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Google, Microsoft, and Slack require OAuth app credentials that haven&apos;t been
          configured for this environment yet — connecting them will be enabled once that setup
          is complete.
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {OAUTH_PROVIDER_KEYS.map((provider) => (
            <Card key={provider} className="p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                  <Link2 className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium">{providerLabel(provider)}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {connectedOAuthProviders.has(provider) ? "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Connect an integration</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            OAuth providers (Google, Microsoft, Slack) aren&apos;t connectable yet — this form
            covers API-key-based providers.
          </p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {API_KEY_PROVIDER_KEYS.map((key) => (
                          <SelectItem key={key} value={key}>
                            {providerLabel(key)}
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
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Display name</FormLabel>
                    <FormControl>
                      <Input autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="apiKey"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>API key (optional)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="webhookSecret"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Webhook secret (optional)</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createConnection.isPending}>
                  Connect
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
