"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Package, Plus } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCreateApp, useMyApps } from "@/hooks/use-marketplace";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { MarketplaceAppCategory } from "@/lib/api/marketplace";
import { formatDate } from "@/lib/format";

const CATEGORIES: MarketplaceAppCategory[] = [
  "PRODUCTIVITY",
  "ANALYTICS",
  "COMMUNICATION",
  "SALES",
  "FINANCE",
  "OTHER",
];

const STATUS_VARIANT: Record<string, "default" | "success" | "warning" | "destructive"> = {
  DRAFT: "default",
  PENDING_REVIEW: "warning",
  PUBLISHED: "success",
  SUSPENDED: "destructive",
};

const formSchema = z.object({
  name: z.string().trim().min(1, "Give this app a name").max(120),
  description: z.string().trim().max(1000).optional(),
  category: z.enum(["PRODUCTIVITY", "ANALYTICS", "COMMUNICATION", "SALES", "FINANCE", "OTHER"]),
  iconUrl: z.string().trim().url("Must be a valid URL").optional().or(z.literal("")),
});
type FormValues = z.infer<typeof formSchema>;

export default function MyAppsPage() {
  const { data, isLoading } = useMyApps();
  const createApp = useCreateApp();
  const [open, setOpen] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: "", description: "", category: "PRODUCTIVITY", iconUrl: "" },
  });

  async function onSubmit(values: FormValues) {
    try {
      const app = await createApp.mutateAsync({
        name: values.name,
        description: values.description || undefined,
        category: values.category,
        iconUrl: values.iconUrl || undefined,
      });
      toast.success(`Created "${app.name}"`);
      setOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">My Apps</h2>
          <p className="text-sm text-muted-foreground">
            Publish an app for other organizations to install. New versions go through
            platform-admin review before they&apos;re listed.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          New app
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
            icon={Package}
            title="No apps yet"
            description="Create your first app, then submit a version for review."
          />
        )}

        {!isLoading && data && data.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">{app.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{app.category}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[app.status]}>{app.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(app.createdAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button size="sm" variant="outline" asChild>
                        <Link href={`/marketplace/apps/${app.id}`}>Manage</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new app</DialogTitle>
            <DialogDescription>
              Starts in Draft. Submit a version to move it into platform-admin review.
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
                      <Textarea placeholder="What does this app do?" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((category) => (
                          <SelectItem key={category} value={category}>
                            {category.charAt(0) + category.slice(1).toLowerCase()}
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
                name="iconUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Icon URL (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="https://acme.example/icon.png" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createApp.isPending}>
                  Create app
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
