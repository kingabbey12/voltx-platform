"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Timer,
  Terminal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
  SUCCEEDED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  FAILED: "bg-red-500/10 text-red-600 dark:text-red-400",
  RUNNING: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  TIMED_OUT: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  WAITING_APPROVAL: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "\u2014";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

export default function AgentsActivityPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAiActivity({ limit: 50 });

  const items = data?.items ?? [];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Activity</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent agent runs across all agents.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search activity..."
          className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!isLoading && items.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Terminal className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No activity yet</p>
              <p className="text-xs text-muted-foreground/60">
                Runs from all agents will appear here.
              </p>
            </div>
          )}

          {items.length > 0 && (
            <div className="divide-y divide-border">
              {items.map((run) => (
                <motion.div
                  key={run.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center gap-4 px-4 py-3 text-sm"
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", STATUS_COLOR[run.status] ?? "bg-muted")}>
                    {React.createElement(STATUS_ICON[run.status] ?? Clock, { className: "h-4 w-4" })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium">
                        <Link href={`/ai/agents/${run.agentId}`} className="hover:underline">
                          Agent {run.agentId.slice(0, 8)}
                        </Link>
                      </p>
                      <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium", STATUS_COLOR[run.status] ?? "")}>
                        {run.status.toLowerCase()}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Timer className="h-3 w-3" />
                        {formatDuration(run.durationMs)}
                      </span>
                      <span>{run.toolCallCount} tool calls</span>
                      <span>{new Date(run.startedAt).toLocaleString()}</span>
                    </div>
                  </div>
                  {run.error && (
                    <span className="hidden max-w-[200px] truncate text-[11px] text-red-500 sm:block" title={run.error}>
                      {run.error}
                    </span>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
