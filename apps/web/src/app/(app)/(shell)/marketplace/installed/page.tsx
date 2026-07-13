"use client";

import Link from "next/link";
import { Blocks } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInstalledApps, usePublishedApp, useUninstallApp } from "@/hooks/use-marketplace";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";
import type { MarketplaceInstall } from "@/lib/api/marketplace";

function InstalledAppRow({ install }: { install: MarketplaceInstall }) {
  const { data: app } = usePublishedApp(install.appId);
  const uninstallApp = useUninstallApp();

  async function onUninstall() {
    try {
      await uninstallApp.mutateAsync(install.id);
      toast.success(`Uninstalled "${app?.name ?? "app"}"`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <TableRow>
      <TableCell>
        <Link href={`/marketplace/${install.appId}`} className="font-medium hover:text-primary">
          {app?.name ?? "Loading..."}
        </Link>
      </TableCell>
      <TableCell className="text-muted-foreground">{formatDate(install.createdAt)}</TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={onUninstall} isLoading={uninstallApp.isPending}>
            Uninstall
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

export default function MyInstallsPage() {
  const { data, isLoading } = useInstalledApps();

  return (
    <div>
      {isLoading && (
        <div className="flex flex-col gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
          ))}
        </div>
      )}

      {!isLoading && data?.length === 0 && (
        <EmptyState
          icon={Blocks}
          title="No apps installed"
          description="Browse the Marketplace to find apps your organization can install."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse Marketplace</Link>
            </Button>
          }
        />
      )}

      {!isLoading && data && data.length > 0 && (
        <div className="rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>App</TableHead>
                <TableHead>Installed</TableHead>
                <TableHead className="w-32" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((install) => (
                <InstalledAppRow key={install.id} install={install} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
