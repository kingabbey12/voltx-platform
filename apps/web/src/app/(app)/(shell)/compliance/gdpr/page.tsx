"use client";

import { useState } from "react";
import { AlertTriangle, Download, ShieldAlert } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDeleteUserData, useExportUserData } from "@/hooks/use-compliance";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { GdprDeletionResult, GdprExportResult } from "@/lib/api/compliance";
import { formatDate } from "@/lib/format";

export default function GdprPage() {
  const exportData = useExportUserData();
  const deleteData = useDeleteUserData();

  const [exportUserId, setExportUserId] = useState("");
  const [deleteUserId, setDeleteUserId] = useState("");
  const [exportResult, setExportResult] = useState<GdprExportResult | null>(null);
  const [deletionResult, setDeletionResult] = useState<GdprDeletionResult | null>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function onExport() {
    if (!exportUserId.trim()) return;
    try {
      const result = await exportData.mutateAsync(exportUserId.trim());
      setExportResult(result);
      toast.success("Export ready");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onDelete() {
    if (!deleteUserId.trim()) return;
    try {
      const result = await deleteData.mutateAsync(deleteUserId.trim());
      setDeletionResult(result);
      setConfirmDeleteOpen(false);
      toast.success("Erasure request processed");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
      setConfirmDeleteOpen(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <h2 className="text-base font-semibold">Data export (Right to Access)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate a downloadable export of everything Voltx holds about a given user.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="export-user-id">User ID</Label>
            <Input
              id="export-user-id"
              value={exportUserId}
              onChange={(event) => setExportUserId(event.target.value)}
              placeholder="uuid"
            />
          </div>
          <Button onClick={onExport} isLoading={exportData.isPending} disabled={!exportUserId.trim()}>
            <Download className="h-4 w-4" />
            Export
          </Button>
        </div>

        {exportResult && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">
                Exported {formatDate(exportResult.exportedAt)} — link expires{" "}
                {formatDate(exportResult.expiresAt)}
              </p>
              <a href={exportResult.downloadUrl} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline">
                  <Download className="h-3.5 w-3.5" />
                  Download
                </Button>
              </a>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {exportResult.sections.map((section) => (
                <Badge key={section.model} variant="secondary" className="font-mono text-[11px]">
                  {section.label}: {section.rowCount}
                </Badge>
              ))}
            </div>
            {exportResult.excludedFromErasure.length > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                Excluded from future erasure (legal/compliance retention):{" "}
                {exportResult.excludedFromErasure.join(", ")}
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-base font-semibold">Data erasure (Right to be Forgotten)</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Permanently deletes or anonymizes a user&apos;s data. Blocked if an active legal hold covers
          them. This cannot be undone.
        </p>
        <div className="mt-4 flex items-end gap-3">
          <div className="flex-1">
            <Label htmlFor="delete-user-id">User ID</Label>
            <Input
              id="delete-user-id"
              value={deleteUserId}
              onChange={(event) => setDeleteUserId(event.target.value)}
              placeholder="uuid"
            />
          </div>
          <Button
            variant="destructive"
            onClick={() => setConfirmDeleteOpen(true)}
            disabled={!deleteUserId.trim()}
          >
            <ShieldAlert className="h-4 w-4" />
            Erase data
          </Button>
        </div>

        {deletionResult && (
          <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4">
            <p className="text-sm text-muted-foreground">
              Global identity scrubbed:{" "}
              <span className="font-medium text-foreground">
                {deletionResult.globalIdentityScrubbed ? "Yes" : "No"}
              </span>
            </p>
            <div className="mt-3 flex flex-col gap-1.5">
              {deletionResult.results.map((outcome) => (
                <div key={outcome.model} className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{outcome.label}</span>
                  <div className="flex items-center gap-2">
                    {outcome.reason && (
                      <span className="text-xs text-muted-foreground">{outcome.reason}</span>
                    )}
                    <Badge
                      variant={
                        outcome.action === "EXCLUDED"
                          ? "warning"
                          : outcome.action === "ANONYMIZE"
                            ? "info"
                            : "destructive"
                      }
                    >
                      {outcome.action} ({outcome.affected})
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      <Dialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm permanent erasure
            </DialogTitle>
            <DialogDescription>
              This will delete or anonymize every record Voltx holds for this user, except data under
              legal hold or independent retention requirements. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} isLoading={deleteData.isPending}>
              Erase permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
