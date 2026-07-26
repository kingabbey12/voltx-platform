"use client";

import { Database, CheckCircle2, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useKnowledgeHealth, useKnowledgeStats } from "@/hooks/use-knowledge";
import { cn } from "@/lib/utils";

export function KnowledgeHealthWidget() {
  const { data: health, isLoading: healthLoading } = useKnowledgeHealth();
  const { data: stats, isLoading: statsLoading } = useKnowledgeStats();

  const isLoading = healthLoading || statsLoading;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Database className="h-4 w-4" />
          Knowledge Health
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-secondary/60" />
            ))}
          </div>
        )}
        {!isLoading && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              {health?.healthy ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )}
              <span className={cn("text-sm font-medium", health?.healthy ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                {health?.healthy ? "Healthy" : "Issues detected"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="font-semibold">{stats?.indexSize.documentCount ?? 0}</p>
                <p className="text-muted-foreground">Docs</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="font-semibold">{stats?.indexSize.chunkCount ?? 0}</p>
                <p className="text-muted-foreground">Chunks</p>
              </div>
              <div className="rounded-lg bg-secondary/50 p-2">
                <p className="font-semibold">{stats?.indexSize.sourceCount ?? 0}</p>
                <p className="text-muted-foreground">Sources</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
