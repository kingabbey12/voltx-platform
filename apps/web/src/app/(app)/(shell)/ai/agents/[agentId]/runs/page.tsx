"use client";

import React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bot,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Play,
  Search,
  Terminal,
  Timer,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAgent, useRunTree } from "@/hooks/use-agents";
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

function formatTokens(tokens: Record<string, unknown>): string {
  const total = tokens?.totalTokens ?? tokens?.total_tokens;
  if (typeof total === "number") return total.toLocaleString();
  return "\u2014";
}

export default function AgentRunsHistoryPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;

  const { data: agent, isLoading: agentLoading } = useAgent(agentId);
  const { data: activity, isLoading: activityLoading } = useRunTree(null);

  // Show all runs - for a real impl we'd use a runs list API, but for now use the dashboard activity
  // This page is a placeholder showing the run tree concept

  if (agentLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Agent not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/ai/agents")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Run History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Execution history for <strong>{agent.name}</strong>
          </p>
        </div>
        <div className="ml-auto">
          <Link href={`/ai/agents/${agentId}/run`}>
            <Button size="sm">
              <Play className="h-4 w-4" />
              New Run
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search runs..."
            className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-xs outline-none focus:border-primary"
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {activityLoading && (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!activityLoading && (!activity || activity.length === 0) && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Terminal className="h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No run history yet</p>
              <p className="text-xs text-muted-foreground/60">
                Run this agent to see its execution history here.
              </p>
              <Link href={`/ai/agents/${agentId}/run`}>
                <Button size="sm" className="mt-2">
                  <Play className="h-4 w-4" />
                  Run Agent
                </Button>
              </Link>
            </div>
          )}

          {activity && activity.length > 0 && (
            <div className="divide-y divide-border">
              {activity.map((run) => (
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
                      <p className="truncate font-medium">{run.id.slice(0, 8)}...</p>
                      <span className={cn("inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium", STATUS_COLOR[run.status] ?? "")}>
                        {run.status.toLowerCase()}
                      </span>
                      {run.depth > 0 && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Layers className="h-3 w-3" />
                          depth {run.depth}
                        </span>
                      )}
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
                  <div className="hidden items-center gap-2 sm:flex">
                    <span className="text-[11px] text-muted-foreground">
                      {formatTokens(run.tokenUsage as Record<string, unknown>)} tokens
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
