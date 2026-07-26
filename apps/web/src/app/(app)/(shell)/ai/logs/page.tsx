"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Search, X, Download, Filter, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useAiActivity } from "@/hooks/use-ai-dashboard";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const SEVERITY_LEVELS = ["SUCCEEDED", "FAILED", "IN_PROGRESS", "WAITING_APPROVAL", "TIMED_OUT"] as const;
const SEVERITY_COLORS: Record<string, string> = {
  SUCCEEDED: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/15 text-red-600 dark:text-red-400",
  IN_PROGRESS: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  WAITING_APPROVAL: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  TIMED_OUT: "bg-orange-500/15 text-orange-600 dark:text-orange-400",
};

export default function AiLogsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data, isLoading } = useAiActivity({ page: 1, limit: 100 });

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["ai", "dashboard", "activity"] });
      }, 5000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, queryClient]);

  const filtered = (data?.items ?? []).filter((run) => {
    if (search) {
      const q = search.toLowerCase();
      const inputText = JSON.stringify(run.input).toLowerCase();
      const outputText = run.output?.outputText?.toLowerCase() ?? "";
      if (
        !run.id.toLowerCase().includes(q) &&
        !run.agentId.toLowerCase().includes(q) &&
        !inputText.includes(q) &&
        !outputText.includes(q)
      ) {
        return false;
      }
    }
    if (statusFilter !== "ALL" && run.status !== statusFilter) return false;
    return true;
  });

  const exportCsv = useCallback(() => {
    const headers = ["ID", "Status", "Agent ID", "Started At", "Duration (ms)", "Input", "Output"];
    const rows = filtered.map((run) => [
      run.id,
      run.status,
      run.agentId,
      run.startedAt,
      run.durationMs?.toString() ?? "",
      JSON.stringify(run.input).replace(/"/g, '""'),
      (run.output?.outputText ?? "").replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported as CSV");
  }, [filtered]);

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-logs-${new Date().toISOString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Logs exported as JSON");
  }, [filtered]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Logs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Stream of AI agent runs and workflow executions.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((p) => !p)}
          >
            <RefreshCw className={cn("h-4 w-4", autoRefresh && "animate-spin")} />
            {autoRefresh ? "Auto (5s)" : "Paused"}
          </Button>
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="h-4 w-4" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportJson}>
            <Download className="h-4 w-4" />
            JSON
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by ID, agent, input, output..."
            className="pl-8 pr-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => setSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]">
            <Filter className="h-3.5 w-3.5 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            {SEVERITY_LEVELS.map((s) => (
              <SelectItem key={s} value={s}>
                {s.replace(/_/g, " ")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground">
          {filtered.length} of {data?.items.length ?? 0} results
        </span>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Agent Run Logs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          )}
          {!isLoading && filtered.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">ID</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Agent</TableHead>
                  <TableHead className="text-xs">Duration</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="text-xs font-mono max-w-[120px] truncate" title={run.id}>
                      {run.id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          SEVERITY_COLORS[run.status],
                        )}
                      >
                        {run.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[100px] truncate" title={run.agentId}>
                      {run.agentId.slice(0, 8)}...
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {run.durationMs ? `${run.durationMs}ms` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(run.startedAt ?? run.createdAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!isLoading && filtered.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-sm text-muted-foreground">No log entries found.</p>
              {search && (
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                  }}
                >
                  Clear filters
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
