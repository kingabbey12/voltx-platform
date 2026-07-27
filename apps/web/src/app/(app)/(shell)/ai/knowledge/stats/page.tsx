"use client";

import {
  Database,
  FileText,
  Hash,
  Link2,
  Search,
  Layers,
  BookOpen,
  Activity,
  TrendingUp,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKnowledgeStats } from "@/hooks/use-knowledge";
import { cn } from "@/lib/utils";

function MetricCard({
  icon: Icon,
  label,
  value,
  secondary,
  loading,
  trend,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  secondary?: string;
  loading?: boolean;
  trend?: "up" | "down" | "neutral";
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", color ?? "bg-primary/10")}>
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                trend === "up" && "bg-emerald-500/10 text-emerald-600",
                trend === "down" && "bg-red-500/10 text-red-600",
                trend === "neutral" && "bg-muted text-muted-foreground",
              )}
            >
              <ArrowUpRight className={cn("h-3 w-3", trend === "down" && "rotate-90")} />
            </span>
          )}
        </div>
        <div className="mt-3">
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/50" />
          ) : (
            <p className="text-2xl font-semibold tracking-tight">{value}</p>
          )}
          <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
          {secondary && (
            <p className="mt-0.5 text-[11px] text-muted-foreground/60">{secondary}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KnowledgeStatsPage() {
  const { data: stats, isLoading } = useKnowledgeStats();

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Statistics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Detailed metrics about the knowledge index and retrieval performance.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Database} label="Sources" value={stats?.indexSize.sourceCount ?? "\u2014"} loading={isLoading} color="bg-blue-500/10" />
        <MetricCard icon={FileText} label="Documents" value={stats?.indexSize.documentCount ?? "\u2014"} loading={isLoading} color="bg-violet-500/10" />
        <MetricCard icon={Hash} label="Chunks" value={stats?.indexSize.chunkCount ?? "\u2014"} secondary="Text segments indexed" loading={isLoading} color="bg-amber-500/10" />
        <MetricCard icon={Link2} label="Relationships" value={stats?.indexSize.relationshipCount ?? "\u2014"} secondary="Entity connections" loading={isLoading} color="bg-emerald-500/10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <MetricCard icon={Search} label="Total Searches" value={stats?.retrieval.searchCount ?? "\u2014"} loading={isLoading} color="bg-rose-500/10" />
        <MetricCard icon={Layers} label="Embedding Calls" value={stats?.embedding.callCount ?? "\u2014"} loading={isLoading} color="bg-cyan-500/10" />
        <MetricCard icon={BookOpen} label="Hit Rate" value={stats ? `${(stats.retrieval.hitRate * 100).toFixed(1)}%` : "\u2014"} loading={isLoading} color="bg-indigo-500/10" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" />
            Retrieval Performance
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-secondary/60" />
          ) : stats ? (
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Search Count</p>
                <p className="text-3xl font-semibold">{stats.retrieval.searchCount}</p>
                <div className="h-1.5 w-full rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min((stats.retrieval.searchCount / 1000) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Hit Rate</p>
                <p className="text-3xl font-semibold">{(stats.retrieval.hitRate * 100).toFixed(1)}%</p>
                <div className="h-1.5 w-full rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${stats.retrieval.hitRate * 100}%` }}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Embedding Calls</p>
                <p className="text-3xl font-semibold">{stats.embedding.callCount}</p>
                <div className="h-1.5 w-full rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-cyan-500 transition-all"
                    style={{ width: `${Math.min((stats.embedding.callCount / 5000) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No statistics available.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="h-4 w-4" />
            Index Composition
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="h-24 animate-pulse rounded-lg bg-secondary/60" />
          ) : stats ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Sources</p>
                <p className="text-2xl font-semibold">{stats.indexSize.sourceCount}</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Documents</p>
                <p className="text-2xl font-semibold">{stats.indexSize.documentCount}</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Chunks</p>
                <p className="text-2xl font-semibold">{stats.indexSize.chunkCount}</p>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-muted-foreground">Relationships</p>
                <p className="text-2xl font-semibold">{stats.indexSize.relationshipCount}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No statistics available.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
