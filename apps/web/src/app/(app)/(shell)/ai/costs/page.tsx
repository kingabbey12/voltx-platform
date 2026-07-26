"use client";

import { useState, useMemo } from "react";
import {
  DollarSign,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAiPerformance } from "@/hooks/use-ai-dashboard";
import { useKnowledgeStats } from "@/hooks/use-ai-monitoring";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
type PeriodTab = "7d" | "30d" | "90d";
const PERIOD_LABELS: Record<PeriodTab, string> = { "7d": "Last 7 days", "30d": "Last 30 days", "90d": "Last 90 days" };

export default function AiCostsPage() {
  const [periodTab, setPeriodTab] = useState<PeriodTab>("30d");
  const [sortField, setSortField] = useState<"cost" | "tokens" | "calls">("cost");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const periodMap: Record<PeriodTab, number> = { "7d": 7, "30d": 30, "90d": 90 };
  const { data: perf, isLoading: perfLoading } = useAiPerformance(periodMap[periodTab]);
  const { data: kStats, isLoading: ksLoading } = useKnowledgeStats();



  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedByAgent = useMemo(() => {
    if (!perf?.byAgent) return [];
    const sorted = [...perf.byAgent];
    sorted.sort((a, b) => {
      let cmp = 0;
      if (sortField === "cost") cmp = a.totalCostUsd - b.totalCostUsd;
      else if (sortField === "tokens") cmp = a.totalTokens - b.totalTokens;
      else cmp = a.callCount - b.callCount;
      return sortDir === "desc" ? -cmp : cmp;
    });
    return sorted;
  }, [perf, sortField, sortDir]);

  const embeddingCost = kStats?.embedding.totalCostUsd ?? 0;
  const totalCost = (perf?.totalCostUsd ?? 0) + embeddingCost;
  const costPerCall = perf?.totalCallCount ? totalCost / perf.totalCallCount : 0;
  const tokensPerDollar = totalCost > 0 ? (perf?.totalTokens ?? 0) / totalCost : 0;

  const budgetUsd = 5000;
  const pctUsed = (totalCost / budgetUsd) * 100;
  const budgetColor = pctUsed > 80 ? "destructive" : pctUsed > 50 ? "warning" : "success";

  const anomaly = sortedByAgent.find((a) => a.totalCostUsd > totalCost * 0.4);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Costs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          AI cost analytics, budget tracking, and anomaly detection.
        </p>
      </div>

      {/* Period tabs */}
      <div className="flex items-center gap-2 border-b pb-2">
        {(Object.keys(PERIOD_LABELS) as PeriodTab[]).map((key) => (
          <button
            key={key}
            onClick={() => setPeriodTab(key)}
            className={cn(
              "text-sm px-3 py-1 rounded-md transition-colors",
              periodTab === key
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {PERIOD_LABELS[key]}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Total Cost
              <DollarSign className="h-3 w-3" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-20 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCurrency(totalCost)
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Cost / Call
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              `$${costPerCall.toFixed(4)}`
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Tokens / $
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {perfLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              tokensPerDollar.toLocaleString(undefined, { maximumFractionDigits: 0 })
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              Embeddings
            </CardTitle>
          </CardHeader>
          <CardContent className="text-lg font-semibold tabular-nums">
            {ksLoading ? (
              <div className="h-7 w-16 animate-pulse rounded bg-secondary/60" />
            ) : (
              formatCurrency(embeddingCost)
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget tracking card */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm">Budget Tracking</CardTitle>
          <Badge variant={budgetColor} className="text-[10px]">
            {pctUsed.toFixed(0)}% used
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Spent</span>
            <span className="font-medium tabular-nums">{formatCurrency(totalCost)}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-secondary overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                pctUsed > 80 ? "bg-destructive" : pctUsed > 50 ? "bg-warning" : "bg-success",
              )}
              style={{ width: `${Math.min(pctUsed, 100)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">0</span>
            <span className="text-muted-foreground">{formatCurrency(budgetUsd)}</span>
          </div>

          {/* Slider controls */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Budget</label>
              <input
                type="range"
                min={500}
                max={50000}
                step={500}
                defaultValue={budgetUsd}
                className="w-full accent-primary"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Alert at</label>
              <input
                type="range"
                min={50}
                max={100}
                step={5}
                defaultValue={80}
                className="w-full accent-amber-500"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground">Auto-stop at</label>
              <input
                type="range"
                min={80}
                max={200}
                step={5}
                defaultValue={120}
                className="w-full accent-destructive"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Provider breakdown */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            Cost By Agent
            {anomaly && (
              <span className="inline-flex items-center gap-1 text-xs text-amber-500 ml-2">
                <AlertTriangle className="h-3.5 w-3.5" />
                {anomaly.agentName ?? anomaly.agentId}: {((anomaly.totalCostUsd / totalCost) * 100).toFixed(0)}%
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {perfLoading && (
            <div className="p-4 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-7 animate-pulse rounded bg-secondary/60" />
              ))}
            </div>
          )}
          {!perfLoading && sortedByAgent.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Agent</TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort("calls")}>
                    <span className="inline-flex items-center gap-1">
                      Calls <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort("tokens")}>
                    <span className="inline-flex items-center gap-1">
                      Tokens <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs cursor-pointer" onClick={() => toggleSort("cost")}>
                    <span className="inline-flex items-center gap-1">
                      Cost <ArrowUpDown className="h-3 w-3" />
                    </span>
                  </TableHead>
                  <TableHead className="text-xs">%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedByAgent.map((entry) => (
                  <TableRow key={entry.agentId ?? "unknown"}>
                    <TableCell className="text-xs font-medium">
                      {entry.agentName ?? entry.agentId ?? "Unknown"}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {entry.callCount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      {entry.totalTokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums font-medium">
                      {formatCurrency(entry.totalCostUsd)}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {totalCost > 0
                        ? ((entry.totalCostUsd / totalCost) * 100).toFixed(1)
                        : "0"}
                      %
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
          {!perfLoading && sortedByAgent.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground text-center">No cost data available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
