"use client";

import { use, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Check, Copy, Package, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
import { useAppAiTools, useAppVersions, useCreateAppVersion, useMyApp } from "@/hooks/use-marketplace";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";

const VERSION_STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  DRAFT: "default",
  PENDING_REVIEW: "warning",
  PUBLISHED: "success",
  REJECTED: "destructive",
};

const formSchema = z.object({
  version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Must be a semantic version, e.g. 1.0.0"),
  changelog: z.string().trim().max(2000).optional(),
  priceCents: z.coerce.number().int().min(0).max(100000000).optional(),
  manifest: z.string().trim().min(1, "Manifest JSON is required"),
});
type FormValues = z.infer<typeof formSchema>;

export default function ManageAppPage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const { data: app } = useMyApp(appId);
  const { data: versions, isLoading: versionsLoading } = useAppVersions(appId);
  const { data: aiTools } = useAppAiTools(appId);
  const createVersion = useCreateAppVersion(appId);
  const [open, setOpen] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      version: "1.0.0",
      changelog: "",
      priceCents: 0,
      manifest: '{\n  "pages": [],\n  "widgets": [],\n  "navEntries": [],\n  "aiTools": []\n}',
    },
  });

  async function onSubmit(values: FormValues) {
    let manifest: Record<string, unknown>;
    try {
      manifest = JSON.parse(values.manifest) as Record<string, unknown>;
    } catch {
      form.setError("manifest", { message: "Manifest must be valid JSON" });
      return;
    }
    try {
      await createVersion.mutateAsync({
        version: values.version,
        manifest,
        changelog: values.changelog || undefined,
        priceCents: values.priceCents,
      });
      toast.success(`Version ${values.version} submitted for review`);
      setOpen(false);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  function copySecret(secret: string) {
    void navigator.clipboard.writeText(secret);
    setCopiedSecret(secret);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedSecret(null), 2000);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/marketplace/apps"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to My Apps
      </Link>

      <div className="mt-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{app?.name ?? "Loading..."}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{app?.description}</p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          Submit version
        </Button>
      </div>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-foreground">Versions</h2>
        <div className="mt-4 rounded-xl border border-border">
          {versionsLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}
          {!versionsLoading && versions?.length === 0 && (
            <EmptyState
              icon={Package}
              title="No versions yet"
              description="Submit your first version to enter review."
            />
          )}
          {!versionsLoading && versions && versions.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Version</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {versions.map((version) => (
                  <TableRow key={version.id}>
                    <TableCell className="font-mono text-sm">{version.version}</TableCell>
                    <TableCell>
                      {version.priceCents === 0 ? "Free" : `$${(version.priceCents / 100).toFixed(2)}`}
                    </TableCell>
                    <TableCell>
                      <Badge variant={VERSION_STATUS_VARIANT[version.status]}>{version.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(version.createdAt)}</TableCell>
                    <TableCell className="max-w-xs text-sm text-muted-foreground">
                      {version.rejectionReason ?? version.changelog ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {aiTools && aiTools.length > 0 && (
        <div className="mt-8">
          <h2 className="text-base font-semibold text-foreground">Custom AI Tools</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure your endpoint to verify the{" "}
            <code className="rounded bg-secondary px-1 py-0.5 text-xs">X-Voltx-Signature</code>{" "}
            header using the signing secret below.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {aiTools.map((tool) => (
              <Card key={tool.id} className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm font-medium text-foreground">{tool.name}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{tool.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{tool.endpointUrl}</p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-secondary/50 p-3">
                  <code className="flex-1 overflow-x-auto whitespace-nowrap text-xs">
                    {tool.signingSecret}
                  </code>
                  <Button size="sm" variant="outline" onClick={() => copySecret(tool.signingSecret)}>
                    {copiedSecret === tool.signingSecret ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Submit a new version</DialogTitle>
            <DialogDescription>
              The manifest describes any Custom Pages, Widgets, Nav entries, and AI Tools this
              version ships. It&apos;s validated against the fixed component palette on submit.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="version"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Version</FormLabel>
                      <FormControl>
                        <Input placeholder="1.0.0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="priceCents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price (cents)</FormLabel>
                      <FormControl>
                        <Input type="number" min={0} placeholder="0" {...field} />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">0 = free</p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="changelog"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Changelog (optional)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="What changed in this version?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="manifest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Manifest (JSON)</FormLabel>
                    <FormControl>
                      <Textarea className="min-h-40 font-mono text-xs" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createVersion.isPending}>
                  Submit for review
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
