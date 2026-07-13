"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Check, Copy, Plus, Trash2, Webhook as WebhookIcon } from "lucide-react";
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
import {
  useCreateWebhookEndpoint,
  useDeleteWebhookEndpoint,
  useSetWebhookEndpointStatus,
  useUpdateWebhookEndpoint,
  useWebhookEndpoints,
} from "@/hooks/use-developer-portal";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { WEBHOOK_EVENT_CATALOG, type WebhookEndpoint } from "@/lib/api/developer-portal";
import { formatDate } from "@/lib/format";

const formSchema = z.object({
  url: z.string().trim().url("Must be a valid URL"),
  description: z.string().trim().max(1000).optional(),
});
type FormValues = z.infer<typeof formSchema>;

const STATUS_VARIANT: Record<string, "success" | "destructive"> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
};

export default function WebhooksPage() {
  const { data, isLoading } = useWebhookEndpoints();
  const createEndpoint = useCreateWebhookEndpoint();
  const updateEndpoint = useUpdateWebhookEndpoint();
  const setStatus = useSetWebhookEndpointStatus();
  const deleteEndpoint = useDeleteWebhookEndpoint();

  const [dialogMode, setDialogMode] = useState<"create" | "edit" | null>(null);
  const [editing, setEditing] = useState<WebhookEndpoint | null>(null);
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<WebhookEndpoint | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { url: "", description: "" },
  });

  function openCreate() {
    form.reset({ url: "", description: "" });
    setEventTypes([]);
    setDialogMode("create");
  }

  function openEdit(endpoint: WebhookEndpoint) {
    setEditing(endpoint);
    form.reset({ url: endpoint.url, description: endpoint.description ?? "" });
    setEventTypes(endpoint.eventTypes);
    setDialogMode("edit");
  }

  function toggleEventType(key: string) {
    setEventTypes((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function onSubmit(values: FormValues) {
    if (eventTypes.length === 0) {
      toast.error("Subscribe to at least one event type");
      return;
    }
    try {
      if (dialogMode === "edit" && editing) {
        await updateEndpoint.mutateAsync({
          id: editing.id,
          input: { url: values.url, description: values.description, eventTypes },
        });
        toast.success("Webhook endpoint updated");
        setDialogMode(null);
      } else {
        const result = await createEndpoint.mutateAsync({
          url: values.url,
          description: values.description,
          eventTypes,
        });
        setRevealedSecret(result.secret);
        setDialogMode(null);
      }
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onToggleStatus(endpoint: WebhookEndpoint) {
    try {
      await setStatus.mutateAsync({
        id: endpoint.id,
        action: endpoint.status === "ACTIVE" ? "suspend" : "reactivate",
      });
      toast.success(endpoint.status === "ACTIVE" ? "Endpoint suspended" : "Endpoint reactivated");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onDelete() {
    if (!deleteTarget) return;
    try {
      await deleteEndpoint.mutateAsync(deleteTarget.id);
      toast.success("Webhook endpoint deleted");
      setDeleteTarget(null);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Webhooks</h2>
          <p className="text-sm text-muted-foreground">
            Get an HMAC-signed HTTPS request whenever a subscribed event happens.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Add endpoint
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
            icon={WebhookIcon}
            title="No webhook endpoints yet"
            description="Add one to get notified in real time when events happen."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>URL</TableHead>
                <TableHead>Events</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-72" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((endpoint) => (
                <TableRow key={endpoint.id}>
                  <TableCell>
                    <div className="font-mono text-xs">{endpoint.url}</div>
                    {endpoint.description && (
                      <div className="text-xs text-muted-foreground">{endpoint.description}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {endpoint.eventTypes.slice(0, 2).map((key) => (
                        <Badge key={key} variant="secondary" className="font-mono text-[11px]">
                          {key}
                        </Badge>
                      ))}
                      {endpoint.eventTypes.length > 2 && (
                        <Badge variant="secondary">+{endpoint.eventTypes.length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[endpoint.status]}>{endpoint.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(endpoint.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/developers/webhooks/${endpoint.id}`}>Deliveries</Link>
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(endpoint)}>
                        Edit
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => onToggleStatus(endpoint)}>
                        {endpoint.status === "ACTIVE" ? "Suspend" : "Reactivate"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setDeleteTarget(endpoint)}>
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
            <DialogTitle>{dialogMode === "edit" ? "Edit webhook endpoint" : "Add a webhook endpoint"}</DialogTitle>
            <DialogDescription>Must be https (loopback http is allowed for local development).</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Endpoint URL</FormLabel>
                    <FormControl>
                      <Input placeholder="https://acme.example/webhooks/voltx" {...field} />
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
                      <Input placeholder="Production event sync" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div>
                <p className="text-sm font-medium">Event types</p>
                <div className="mt-2 flex flex-col gap-2 rounded-lg border border-border p-3">
                  {WEBHOOK_EVENT_CATALOG.map((event) => (
                    <label key={event.key} className="flex items-center justify-between gap-4">
                      <span>
                        <span className="block font-mono text-xs">{event.key}</span>
                        <span className="block text-xs text-muted-foreground">{event.description}</span>
                      </span>
                      <Switch
                        checked={eventTypes.includes(event.key)}
                        onCheckedChange={() => toggleEventType(event.key)}
                      />
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogMode(null)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createEndpoint.isPending || updateEndpoint.isPending}>
                  {dialogMode === "edit" ? "Save changes" : "Add endpoint"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={revealedSecret !== null} onOpenChange={(open) => !open && setRevealedSecret(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Signing secret</DialogTitle>
            <DialogDescription>
              Use this to verify the <code className="rounded bg-secondary px-1 py-0.5 text-xs">X-Voltx-Signature</code>{" "}
              header. Shown exactly once.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
            <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">{revealedSecret}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!revealedSecret) return;
                void navigator.clipboard.writeText(revealedSecret);
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
            <DialogTitle>Delete this webhook endpoint?</DialogTitle>
            <DialogDescription>
              This also deletes its delivery history. This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} isLoading={deleteEndpoint.isPending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
