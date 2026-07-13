"use client";

import { use } from "react";
import { PackageOpen } from "lucide-react";
import { useInstalledExtensions } from "@/hooks/use-extensions";
import { ManifestRenderer } from "@/components/extensions/manifest-renderer";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/layout/page-header";

/**
 * The generic host route every installed marketplace app's Custom Page
 * renders through — one route, `path` resolved at runtime against
 * whatever the currently installed apps declared (see
 * ExtensionCustomPage.path), so a new installed app's page needs no new
 * route added to this codebase. Custom Nav entries (Sidebar) link here.
 */
export default function ExtensionPage({ params }: { params: Promise<{ path: string[] }> }) {
  const { path } = use(params);
  const targetPath = `/${path.join("/")}`;
  const { data, isLoading } = useInstalledExtensions();

  const page = data?.pages.find((candidate) => candidate.path === targetPath);

  if (isLoading) {
    return <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (!page) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <EmptyState
          icon={PackageOpen}
          title="Page not found"
          description="This app page isn't installed for your organization, or the app was uninstalled."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <PageHeader title={page.manifest.title} />
      <div className="mt-6">
        <ManifestRenderer node={page.manifest.root} />
      </div>
    </div>
  );
}
