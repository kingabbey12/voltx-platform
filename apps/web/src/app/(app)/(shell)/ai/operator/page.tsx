"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Bot,
  CheckCircle2,
  Clock,
  DollarSign,
  ListChecks,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { formatCurrency, formatRelativeTime } from "@/lib/format";
import {
  useAiActivity,
  useAiPerformance,
  useAiSuggestions,
  useAiTasks,
  useDecideApproval,
  useDismissSuggestion,
} from "@/hooks/use-ai-dashboard";
import type { AgentRunStatus } from "@/lib/api/agents";

type SectionKey = "activity" | "tasks" | "performance" | "suggestions";

const SECTIONS: Array<{ key: SectionKey; label: string; icon: typeof Activity }> = [
  { key: "tasks", label: "Tasks", icon: ListChecks },
  { key: "activity", label: "Activity", icon: Activity },
  { key: "performance", label: "Performance", icon: DollarSign },
  { key: "suggestions", label: "Suggestions", icon: Sparkles },
];

const STATUS_VARIANT: Record<AgentRunStatus, "default" | "success" | "warning" | "destructive"> = {
  RUNNING: "default",
  SUCCEEDED: "success",
  FAILED: "destructive",
  TIMED_OUT: "destructive",
  WAITING_APPROVAL: "warning",
};

export default function AiOperatorDashboardPage() {
  const [section, setSection] = useState<SectionKey>("tasks");

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">AI Operator</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activity, pending tasks, performance, and proactive suggestions across every agent.
        </p>
      </motion.div>

      <div className="mt-6 flex gap-1 rounded-xl border border-border bg-secondary/40 p-1">
        {SECTIONS.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setSection(item.key)}
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              section === item.key
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {section === "activity" && <ActivitySection />}
        {section === "tasks" && <TasksSection />}
        {section === "performance" && <PerformanceSection />}
        {section === "suggestions" && <SuggestionsSection />}
      </div>
    </div>
  );
}

function ActivitySection() {
  const { data, isLoading } = useAiActivity({ limit: 20 });

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-secondary" />;
  }

  if (!data || data.items.length === 0) {
    return (
      <EmptyState
        icon={Activity}
        title="No agent activity yet"
        description="Runs will show up here as soon as an agent executes."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Recent runs</CardTitle>
      </CardHeader>
      <CardContent className="divide-y divide-border p-0">
        {data.items.map((run) => (
          <div key={run.id} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {run.output.outputText?.slice(0, 80) || "(no output yet)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {run.toolCallCount} tool call{run.toolCallCount === 1 ? "" : "s"} ·{" "}
                {formatRelativeTime(run.startedAt)}
              </p>
            </div>
            <Badge variant={STATUS_VARIANT[run.status]}>{run.status.replace("_", " ")}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TasksSection() {
  const { data, isLoading } = useAiTasks();
  const decideApproval = useDecideApproval();

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-secondary" />;
  }

  const pending = data?.pendingApprovals ?? [];
  const inProgress = data?.inProgressRuns ?? [];

  if (pending.length === 0 && inProgress.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nothing needs your attention"
        description="Pending approvals and in-progress runs will appear here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {pending.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Pending approvals</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {pending.map((approval) => (
              <div key={approval.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{approval.toolName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {JSON.stringify(approval.input)}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={decideApproval.isPending}
                    onClick={() =>
                      decideApproval.mutate({ approvalId: approval.id, decision: "REJECTED" })
                    }
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    disabled={decideApproval.isPending}
                    onClick={() =>
                      decideApproval.mutate({ approvalId: approval.id, decision: "APPROVED" })
                    }
                  >
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {inProgress.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">In progress</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {inProgress.map((run) => (
              <div key={run.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <p className="truncate text-sm">{run.id}</p>
                <Badge variant={STATUS_VARIANT[run.status]}>{run.status.replace("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PerformanceSection() {
  const { data, isLoading } = useAiPerformance(30);

  if (isLoading || !data) {
    return <div className="h-48 animate-pulse rounded-xl bg-secondary" />;
  }

  const tiles = [
    { label: "AI calls (30d)", value: String(data.totalCallCount), icon: Activity },
    { label: "Tokens used (30d)", value: data.totalTokens.toLocaleString(), icon: Bot },
    { label: "Estimated spend (30d)", value: formatCurrency(data.totalCostUsd), icon: DollarSign },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label}>
            <CardContent className="flex items-center gap-3 p-5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-primary">
                <tile.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{tile.label}</p>
                <p className="truncate text-xl font-semibold tracking-tight">{tile.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {data.byAgent.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">By agent</CardTitle>
          </CardHeader>
          <CardContent className="divide-y divide-border p-0">
            {data.byAgent.map((entry) => (
              <div
                key={entry.agentId ?? "none"}
                className="flex items-center justify-between gap-4 px-5 py-3"
              >
                <p className="text-sm font-medium">{entry.agentName ?? "Direct chat"}</p>
                <p className="text-sm text-muted-foreground">
                  {entry.callCount} calls · {formatCurrency(entry.totalCostUsd)}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function SuggestionsSection() {
  const { data, isLoading } = useAiSuggestions();
  const dismiss = useDismissSuggestion();

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-secondary" />;
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No suggestions right now"
        description="Check back later — the Executive Assistant reviews activity periodically."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {data.map((suggestion) => (
        <Card key={suggestion.id}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-2">
              <Badge variant="outline">{suggestion.category}</Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatRelativeTime(suggestion.createdAt)}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">{suggestion.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{suggestion.description}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-3"
              disabled={dismiss.isPending}
              onClick={() => dismiss.mutate(suggestion.id)}
            >
              Dismiss
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
