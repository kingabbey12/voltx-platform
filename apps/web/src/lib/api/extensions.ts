import { apiClient } from "./client";

/** A node in a Custom Page/Widget's component tree — the fixed,
 * versioned palette rendered by ManifestRenderer. Mirrors the backend's
 * ManifestComponentNode (manifest-validator.util.ts), which already
 * validated every node's `type` at submission time — this side never
 * re-validates, it only renders. */
export interface ExtensionComponentNode {
  type: string;
  props?: Record<string, unknown>;
  dataSource?: { method: "GET" | "POST"; path: string };
  children?: ExtensionComponentNode[];
}

export interface ExtensionPage {
  id: string;
  path: string;
  manifest: { path: string; title: string; root: ExtensionComponentNode };
}

export interface ExtensionWidget {
  id: string;
  placement: "DASHBOARD" | "CRM_SIDEBAR";
  manifest: { placement: string; root: ExtensionComponentNode };
}

export interface ExtensionNavEntry {
  id: string;
  label: string;
  icon: string | null;
  targetPath: string;
}

export interface InstalledExtensions {
  pages: ExtensionPage[];
  widgets: ExtensionWidget[];
  navEntries: ExtensionNavEntry[];
}

export const extensionsApi = {
  getInstalled: (organizationId: string) =>
    apiClient.get<InstalledExtensions>(`/organizations/${organizationId}/extensions/installed`),
};
