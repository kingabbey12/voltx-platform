"use client";

import React from "react";
import { Activity, Clock, CheckCircle2, XCircle, AlertTriangle, Timer, Terminal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAiActivity } from "@/hooks/use-ai-dashboard";
import { cn } from "@/lib/utils";

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  SUCCEEDED: CheckCircle2,
  FAILED: XCircle,
  RUNNING: Clock,
  TIMED_OUT: AlertTriangle,
  WAITING_APPROVAL: Clock,
};

const STATUS_COLOR: Record<string, string> = {
  SUCCEEDED: "text-emerald-600 dark:text-emerald-400",
  FAILED: "text-red-600 dark:text-red-400",
  RUNNING: "text-blue-600 dark:text-blue-400",
  TIMED_OUT: "text-amber-600 dark:text-amber-400",
  WAITING_APPROVAL: "text-amber-600 dark:text-amber-400",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m`;
}

export function RecentActivityWidget() {
  const { data, isLoading } = useAiActivity({ limit: 10 });

  const items = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <Activity className="h-4 w-4" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-9 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}
        {!isLoading && items.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <Terminal className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No recent activity</p>
          </div>
        )}
        {items.length > 0 && (
          <div className="space-y-1">
            {items.slice(0, 8).map((run) => (
              <div key={run.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-secondary">
                {React.createElement(STATUS_ICON[run.status] ?? Clock, { className: cn("h-3.5 w-3.5 shrink-0", STATUS_COLOR[run.status] ?? "text-muted-foreground") })}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {run.id.slice(0, 8)}...
                  </p>
                </div>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  {formatDuration(run.durationMs)}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {new Date(run.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
