"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Database,
  FileText,
  Hash,
  Layers,
  Link2,
  Loader2,
  Search,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKnowledgeStats, useKnowledgeHealth, useKnowledgeSources } from "@/hooks/use-knowledge";

function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  loading?: boolean;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", color ?? "bg-primary/10")}>
          <Icon className={cn("h-5 w-5", color ? "text-white" : "text-primary")} />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          {loading ? (
            <Loader2 className="mt-1 h-4 w-4 animate-spin text-muted-foreground/50" />
          ) : (
            <p className="text-xl font-semibold tracking-tight">{value}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function KnowledgeDashboardPage() {
  const { data: stats, isLoading: statsLoading } = useKnowledgeStats();
  const { data: health, isLoading: healthLoading } = useKnowledgeHealth();
  const { data: sourcesData, isLoading: sourcesLoading } = useKnowledgeSources({ limit: 5 });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Knowledge Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Overview of your knowledge index, sources, and system health.
        </p>
      </div>

      {!healthLoading && health && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm",
            health.healthy
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400"
              : "border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400",
          )}
        >
          {health.healthy ? (
            <CheckCircle2 className="h-5 w-5 shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 shrink-0" />
          )}
          <div>
            <p className="font-medium">
              {health.healthy ? "Knowledge index is healthy" : "Knowledge index has issues"}
            </p>
            {health.reasons.length > 0 && (
              <ul className="mt-1 list-inside list-disc text-xs text-muted-foreground">
                {health.reasons.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Database} label="Sources" value={stats?.indexSize.sourceCount ?? "\u2014"} loading={statsLoading} color="bg-blue-500/10" />
        <StatCard icon={FileText} label="Documents" value={stats?.indexSize.documentCount ?? "\u2014"} loading={statsLoading} color="bg-violet-500/10" />
        <StatCard icon={Hash} label="Chunks" value={stats?.indexSize.chunkCount ?? "\u2014"} loading={statsLoading} color="bg-amber-500/10" />
        <StatCard icon={Link2} label="Relationships" value={stats?.indexSize.relationshipCount ?? "\u2014"} loading={statsLoading} color="bg-emerald-500/10" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard icon={Search} label="Total Searches" value={stats?.retrieval.searchCount ?? "\u2014"} loading={statsLoading} color="bg-rose-500/10" />
        <StatCard icon={Layers} label="Embedding Calls" value={stats?.embedding.callCount ?? "\u2014"} loading={statsLoading} color="bg-cyan-500/10" />
        <StatCard icon={BookOpen} label="Hit Rate" value={stats ? `${(stats.retrieval.hitRate * 100).toFixed(1)}%` : "\u2014"} loading={statsLoading} color="bg-indigo-500/10" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Sources</CardTitle>
        </CardHeader>
        <CardContent>
          {sourcesLoading && (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!sourcesLoading && (!sourcesData?.items || sourcesData.items.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <Database className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">No sources configured yet</p>
              <p className="text-xs text-muted-foreground/60">Create a source to start indexing knowledge.</p>
            </div>
          )}

          {sourcesData?.items && sourcesData.items.length > 0 && (
            <div className="divide-y divide-border">
              {sourcesData.items.map((source) => (
                <div key={source.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary text-muted-foreground">
                    <Database className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{source.name}</p>
                    <p className="text-xs text-muted-foreground">{source.type}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
                      source.status === "ACTIVE"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : source.status === "ERROR"
                          ? "bg-red-500/10 text-red-600 dark:text-red-400"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {source.status === "ACTIVE" ? <CheckCircle2 className="mr-1 h-3 w-3" /> : source.status === "ERROR" ? <XCircle className="mr-1 h-3 w-3" /> : null}
                    {source.status.toLowerCase()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
