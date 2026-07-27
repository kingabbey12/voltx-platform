"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  Trash2,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useAlerts,
  useAcknowledgeAlert,
  useResolveAlert,
  useDeleteAlert,
  useCreateAlert,
} from "@/hooks/use-ai-monitoring";
import {
  AlertSeverityBadge,
  AlertStatusBadge,
  SEVERITY_CONFIG,
} from "@/components/ai-monitoring/alert-badges";
import { formatRelativeTime } from "@/lib/format";
import type { AlertSeverity, AlertStatus, CreateAlertInput } from "@/lib/api/ai-monitoring";

export default function AiIncidentsPage() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "ALL">("ALL");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "ALL">("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CreateAlertInput>({
    severity: "INFO",
    category: "system",
    title: "",
    description: "",
  });

  const { data, isLoading } = useAlerts({
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    severity: severityFilter !== "ALL" ? severityFilter : undefined,
  });

  const { mutate: acknowledge, isPending: ackPending } = useAcknowledgeAlert();
  const { mutate: resolve, isPending: resolvePending } = useResolveAlert();
  const { mutate: deleteAlert, isPending: deletePending } = useDeleteAlert();
  const { mutate: createAlert, isPending: createPending } = useCreateAlert();

  const handleCreate = () => {
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    createAlert(form, {
      onSuccess: () => {
        toast.success("Alert created");
        setDialogOpen(false);
        setForm({ severity: "INFO", category: "system", title: "", description: "" });
      },
      onError: (err) => toast.error(err.message),
    });
  };

  const filtered = (data?.items ?? []).filter((a) => {
    if (severityFilter !== "ALL" && a.severity !== severityFilter) return false;
    if (statusFilter !== "ALL" && a.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Incidents</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Platform alerts and incident management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["platform", "alerts"] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Create Alert
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Alert</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    placeholder="Brief description of the issue"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}
                  >
                    <SelectTrigger id="category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="system">System</SelectItem>
                      <SelectItem value="knowledge">Knowledge</SelectItem>
                      <SelectItem value="ai">AI</SelectItem>
                      <SelectItem value="workflow">Workflow</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="severity">Severity</Label>
                  <Select
                    value={form.severity}
                    onValueChange={(v) => setForm((f) => ({ ...f, severity: v as AlertSeverity }))}
                  >
                    <SelectTrigger id="severity">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(
                        Object.keys(SEVERITY_CONFIG) as AlertSeverity[]
                      ).map((sev) => (
                        <SelectItem key={sev} value={sev}>
                          {SEVERITY_CONFIG[sev].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={form.description ?? ""}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Optional details"
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={createPending}>
                  {createPending ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={severityFilter}
          onValueChange={(v) => setSeverityFilter(v as AlertSeverity | "ALL")}
        >
          <SelectTrigger className="w-[140px]">
            <AlertTriangle className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All severities</SelectItem>
            {(
              Object.keys(SEVERITY_CONFIG) as AlertSeverity[]
            ).map((sev) => (
              <SelectItem key={sev} value={sev}>
                {SEVERITY_CONFIG[sev].label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as AlertStatus | "ALL")}
        >
          <SelectTrigger className="w-[140px]">
            <Eye className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="DISMISSED">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} alert{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Alerts</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Category</TableHead>
                  <TableHead className="text-xs">Created</TableHead>
                  <TableHead className="text-xs w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((alert) => (
                  <TableRow key={alert.id}>
                    <TableCell>
                      <AlertSeverityBadge severity={alert.severity} />
                    </TableCell>
                    <TableCell>
                      <AlertStatusBadge status={alert.status} />
                    </TableCell>
                    <TableCell className="text-xs font-medium max-w-[200px] truncate" title={alert.title}>
                      {alert.title}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{alert.category}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(alert.createdAt)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {alert.status === "OPEN" && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Acknowledge"
                            disabled={ackPending}
                            onClick={() =>
                              acknowledge(alert.id, {
                                onSuccess: () => toast.success("Alert acknowledged"),
                                onError: (e) => toast.error(e.message),
                              })
                            }
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {(alert.status === "OPEN" || alert.status === "ACKNOWLEDGED") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-emerald-500"
                            title="Resolve"
                            disabled={resolvePending}
                            onClick={() =>
                              resolve(alert.id, {
                                onSuccess: () => toast.success("Alert resolved"),
                                onError: (e) => toast.error(e.message),
                              })
                            }
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          title="Delete"
                          disabled={deletePending}
                          onClick={() =>
                            deleteAlert(alert.id, {
                              onSuccess: () => toast.success("Alert deleted"),
                              onError: (e) => toast.error(e.message),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No alerts found.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
