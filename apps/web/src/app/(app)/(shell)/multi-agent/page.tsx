"use client";

import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  CircleSlash,
  Clock,
  GitMerge,
  RefreshCw,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DEFAULT_OBJECTIVE,
  orchestratorApi,
  type AgentExecutionStatus,
  type AgentResult,
  type OrchestrationResult,
} from "@/lib/api/orchestrator";

const REFRESH_INTERVAL_MS = 60_000;

const STATUS_LABEL: Record<AgentExecutionStatus, string> = {
  succeeded: "Succeeded",
  failed: "Failed",
  timed_out: "Timed out",
  skipped_permission: "Skipped — permission",
  skipped_no_context: "Skipped — no context",
  circuit_open: "Circuit open",
};

const TONE = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  low: "bg-muted text-muted-foreground",
} as const;

function Badge({
  children,
  tone = "low",
  label,
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE;
  label: string;
}) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${TONE[tone]}`}
      aria-label={`${label}: ${String(children)}`}
    >
      {children}
    </span>
  );
}

function AgentCard({ agent }: { agent: AgentResult }) {
  const [open, setOpen] = useState(false);
  const drawerId = `evidence-${agent.agentId}`;

  return (
    <article className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="font-medium">{agent.agentName}</h3>
          <p className="text-xs text-muted-foreground">
            {agent.mode} · v{agent.agentVersion} · {agent.capabilities.join(", ")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={agent.status === "succeeded" ? "low" : "critical"} label="Status">
            {STATUS_LABEL[agent.status]}
          </Badge>
          <Badge tone={agent.priority} label="Priority">
            {agent.priority}
          </Badge>
          <Badge tone="medium" label="Confidence">
            {agent.confidence} confidence
          </Badge>
          {agent.approvalRequired ? (
            <Badge tone="high" label="Approval">
              Approval required
            </Badge>
          ) : null}
        </div>
      </header>

      <p className="text-sm text-muted-foreground">
        {agent.summary || agent.failureReason || "No output."}
      </p>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Duration</dt>
          <dd className="font-medium text-foreground">{agent.executionMs.toFixed(1)} ms</dd>
        </div>
        <div className="flex gap-1">
          <dt>Attempts</dt>
          <dd className="font-medium text-foreground">{agent.attempts}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Decisions</dt>
          <dd className="font-medium text-foreground">{agent.decisionIds.length}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Insights</dt>
          <dd className="font-medium text-foreground">{agent.insightIds.length}</dd>
        </div>
      </dl>

      {agent.recommendations.length > 0 ? (
        <ul className="space-y-1 text-sm">
          {agent.recommendations.map((recommendation) => (
            <li
              key={`${recommendation.decisionId}:${recommendation.code}`}
              className="flex flex-wrap items-center gap-2"
            >
              <ShieldCheck className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span>{recommendation.label}</span>
              {recommendation.requiresApproval ? (
                <Badge tone="high" label="Approval">
                  Approval required
                </Badge>
              ) : (
                <Badge label="Approval">Informational</Badge>
              )}
            </li>
          ))}
        </ul>
      ) : null}

      {agent.evidence.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={drawerId}
            className="flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
          >
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
            {open ? "Hide" : "Show"} evidence ({agent.evidence.length})
          </button>
          <ul id={drawerId} hidden={!open} className="mt-2 space-y-1 border-l pl-3 text-sm">
            {agent.evidence.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-2">
                <Badge tone={item.priority} label="Record priority">
                  {item.priority}
                </Badge>
                <span className="text-muted-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export default function MultiAgentPage() {
  const [objective, setObjective] = useState(DEFAULT_OBJECTIVE);
  const [submitted, setSubmitted] = useState(DEFAULT_OBJECTIVE);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const query = useQuery<OrchestrationResult>({
    queryKey: ["multi-agent", submitted],
    queryFn: ({ signal }) => orchestratorApi.run(submitted, signal),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
    placeholderData: keepPreviousData,
  });

  const agents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.agents ?? []).filter(
      (agent) =>
        (statusFilter === "all" || agent.status === statusFilter) &&
        (term === "" ||
          `${agent.agentName} ${agent.summary} ${agent.capabilities.join(" ")}`
            .toLowerCase()
            .includes(term)),
    );
  }, [query.data, search, statusFilter]);

  if (query.isLoading) {
    return (
      <div className="p-6" aria-busy="true">
        <p className="text-sm text-muted-foreground">Coordinating agents…</p>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="p-6" role="alert">
        <p className="text-destructive">The orchestration could not be loaded.</p>
        <Button className="mt-4" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  const data = query.data;
  const consensus = data?.consensus;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Multi-agent orchestration</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic agent coordination. Agents recommend — they never execute.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh orchestration"
        >
          <RefreshCw className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </Button>
      </header>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(objective.trim() || DEFAULT_OBJECTIVE);
        }}
      >
        <label className="sr-only" htmlFor="objective">
          Objective
        </label>
        <input
          id="objective"
          value={objective}
          onChange={(event) => setObjective(event.target.value)}
          placeholder="Ask across departments…"
          maxLength={2000}
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm"
        />
        <Button type="submit">Coordinate</Button>
      </form>

      <section aria-label="Orchestration summary" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="h-4 w-4" aria-hidden />
            Participating agents
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {consensus?.participatingAgents.length ?? 0}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <GitMerge className="h-4 w-4" aria-hidden />
            Consensus
          </p>
          <p className="mt-1 text-2xl font-semibold">
            {Math.round((consensus?.agreementScore ?? 0) * 100)}%
          </p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Conflicts
          </p>
          <p className="mt-1 text-2xl font-semibold">{data?.conflicts.length ?? 0}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-4 w-4" aria-hidden />
            Total duration
          </p>
          <p className="mt-1 text-2xl font-semibold">{(data?.executionMs ?? 0).toFixed(0)} ms</p>
        </div>
      </section>

      {consensus ? (
        <p className="text-sm text-muted-foreground">{consensus.explanation}</p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search agents"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search agents"
          className="h-9 rounded-md border bg-background px-3 text-sm"
        />
        <select
          aria-label="Filter by execution status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {[...new Set((data?.agents ?? []).map((agent) => agent.status))].map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </div>

      {data?.routing ? (
        <p className="text-xs text-muted-foreground">
          Routed by <span className="font-medium">{data.routing.rule}</span>
          {data.routing.matchedTerms.length > 0
            ? ` on: ${data.routing.matchedTerms.join(", ")}`
            : ""}
          {" · "}
          {data.routing.parallelAgentIds.length} parallel,{" "}
          {data.routing.sequentialAgentIds.length} sequential
        </p>
      ) : null}

      <section aria-label="Execution timeline" className="space-y-2">
        <h2 className="text-sm font-semibold">Execution timeline</h2>
        <ol className="space-y-1">
          {(data?.agents ?? [])
            .slice()
            .sort((left, right) => {
              if (left.mode !== right.mode) return left.mode === "parallel" ? -1 : 1;
              return left.agentId.localeCompare(right.agentId);
            })
            .map((agent) => (
              <li key={agent.agentId} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 text-xs uppercase text-muted-foreground">
                  {agent.mode}
                </span>
                <span className="w-44 shrink-0 truncate">{agent.agentName}</span>
                <span
                  className="h-2 rounded bg-primary/60"
                  style={{
                    width: `${Math.max(
                      2,
                      Math.min(
                        100,
                        (agent.executionMs / Math.max(1, data?.executionMs ?? 1)) * 100,
                      ),
                    )}%`,
                  }}
                  aria-hidden
                />
                <span className="shrink-0 text-xs text-muted-foreground">
                  {agent.executionMs.toFixed(1)} ms
                </span>
              </li>
            ))}
        </ol>
      </section>

      {agents.length > 0 ? (
        <section aria-label="Agent results" className="grid gap-4 md:grid-cols-2">
          {agents.map((agent) => (
            <AgentCard key={agent.agentId} agent={agent} />
          ))}
        </section>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          <CircleSlash className="mx-auto mb-2 h-5 w-5" aria-hidden />
          No agents match the selected filters.
        </div>
      )}

      {data && data.conflicts.length > 0 ? (
        <section aria-label="Conflicts" className="space-y-2">
          <h2 className="text-sm font-semibold">Conflicts</h2>
          <ul className="space-y-2">
            {data.conflicts.map((conflict) => (
              <li key={conflict.id} className="rounded-lg border bg-card p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="high" label="Conflict type">
                    {conflict.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {conflict.agentIds.join(" vs ")}
                  </span>
                </div>
                <p className="mt-1">{conflict.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Kept {conflict.resolvedInFavourOf} — {conflict.resolutionReason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {consensus && consensus.skippedAgents.length > 0 ? (
        <aside className="text-sm text-muted-foreground">
          Skipped agents:{" "}
          {consensus.skippedAgents
            .map((entry) => `${entry.agentId} (${STATUS_LABEL[entry.status]})`)
            .join(", ")}
        </aside>
      ) : null}

      {data && data.excludedSources.length > 0 ? (
        <aside className="text-sm text-muted-foreground">
          Unavailable sources:{" "}
          {data.excludedSources.map((source) => `${source.source} (${source.reason})`).join(", ")}
        </aside>
      ) : null}
    </div>
  );
}
