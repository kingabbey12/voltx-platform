"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronRight,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  decisionsApi,
  type Decision,
  type DecisionCategory,
  type DecisionPriority,
} from "@/lib/api/decisions";

/** Poll interval for the live decision queue. The endpoint is deterministic,
 * so a repeat with unchanged data is a no-op for the user. */
const REFRESH_INTERVAL_MS = 60_000;

const PRIORITY_ORDER: DecisionPriority[] = ["critical", "high", "medium", "low"];

const PRIORITY_VARIANT: Record<DecisionPriority, "destructive" | "warning" | "info" | "outline"> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "outline",
};

const CONFIDENCE_VARIANT = {
  high: "success",
  medium: "info",
  low: "outline",
} as const;

const URGENCY_LABEL = {
  immediate: "Act now",
  this_week: "This week",
  this_month: "This month",
  monitor: "Monitor",
} as const;

const CATEGORY_LABEL: Record<DecisionCategory, string> = {
  sales: "Sales",
  finance: "Finance",
  operations: "Operations",
  communications: "Communications",
  customer_success: "Customer success",
  risk: "Risk",
  executive_priority: "Executive priority",
  compliance: "Compliance",
};

function humanizeMetric(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (character) => character.toUpperCase())
    .trim();
}

export default function ExecutiveDecisionsPage() {
  const [category, setCategory] = useState<string>("all");
  const [priority, setPriority] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [openDecisionId, setOpenDecisionId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["executive-decisions"],
    queryFn: ({ signal }) => decisionsApi.get(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const decisions = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data?.decisions ?? []).filter(
      (decision) =>
        (category === "all" || decision.category === category) &&
        (priority === "all" || decision.priority === priority) &&
        (term === "" ||
          `${decision.title} ${decision.summary} ${decision.recommendedAction.label}`
            .toLowerCase()
            .includes(term)),
    );
  }, [query.data, category, priority, search]);

  const openDecision = useMemo(
    () => decisions.find((decision) => decision.id === openDecisionId) ?? null,
    [decisions, openDecisionId],
  );

  // Close the drawer if its decision drops out of the filtered queue.
  useEffect(() => {
    if (openDecisionId && !openDecision) setOpenDecisionId(null);
  }, [openDecisionId, openDecision]);

  useEffect(() => {
    if (!openDecision) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenDecisionId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openDecision]);

  const categories = useMemo(
    () => [...new Set((query.data?.decisions ?? []).map((decision) => decision.category))].sort(),
    [query.data],
  );

  if (query.isLoading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Executive decisions</h1>
        <p aria-live="polite" className="sr-only">
          Loading executive decisions
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2, 3].map((key) => (
            <Skeleton key={key} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
        <h1 className="text-2xl font-semibold">Executive decisions</h1>
        <div role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-6">
          <p className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            Decisions could not be loaded.
          </p>
          <Button className="mt-4" onClick={() => void query.refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const distribution = query.data?.priorityDistribution;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Executive decisions</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic, evidence-backed recommendations. Nothing here executes automatically.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh decisions"
        >
          <RefreshCw
            className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Refresh
        </Button>
      </header>

      {distribution ? (
        <section aria-label="Priority queue" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {PRIORITY_ORDER.map((level) => (
            <button
              key={level}
              type="button"
              onClick={() => setPriority(priority === level ? "all" : level)}
              aria-pressed={priority === level}
              className={`rounded-lg border bg-card p-4 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                priority === level ? "ring-2 ring-ring" : ""
              }`}
            >
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{level}</span>
              <span className="block text-2xl font-semibold tabular-nums">
                {distribution[level] ?? 0}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Search decisions"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search decisions"
          className="h-9 min-w-[12rem] flex-1 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          aria-label="Filter by category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All categories</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {CATEGORY_LABEL[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="all">All priorities</option>
          {PRIORITY_ORDER.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
      </div>

      {decisions.length === 0 ? (
        <div className="rounded-lg border p-10 text-center">
          <AlertTriangle className="mx-auto mb-3 h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            {(query.data?.decisions.length ?? 0) === 0
              ? "No decisions are available from the sources you can read."
              : "No decisions match the selected filters."}
          </p>
        </div>
      ) : (
        <section aria-label="Decisions" className="grid gap-4 md:grid-cols-2">
          {decisions.map((decision) => (
            <DecisionCard
              key={decision.id}
              decision={decision}
              onOpenEvidence={() => setOpenDecisionId(decision.id)}
            />
          ))}
        </section>
      )}

      {query.data?.excludedSources.length ? (
        <aside className="text-sm text-muted-foreground">
          Sources not included:{" "}
          {query.data.excludedSources
            .map((entry) => `${entry.source} (${entry.reason.replace(/_/g, " ")})`)
            .join(", ")}
          .
        </aside>
      ) : null}

      {openDecision ? (
        <EvidenceDrawer decision={openDecision} onClose={() => setOpenDecisionId(null)} />
      ) : null}
    </div>
  );
}

function DecisionCard({
  decision,
  onOpenEvidence,
}: {
  decision: Decision;
  onOpenEvidence: () => void;
}) {
  return (
    <article
      aria-labelledby={`${decision.id}-title`}
      className="flex flex-col gap-3 rounded-lg border bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 id={`${decision.id}-title`} className="font-medium">
          {decision.title}
        </h2>
        <span className="text-xs uppercase tracking-wide text-muted-foreground">
          {CATEGORY_LABEL[decision.category]}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={PRIORITY_VARIANT[decision.priority]}>{decision.priority} priority</Badge>
        <Badge variant={PRIORITY_VARIANT[decision.riskLevel]}>
          <ShieldAlert className="h-3 w-3" aria-hidden="true" />
          {decision.riskLevel} risk
        </Badge>
        <Badge variant={CONFIDENCE_VARIANT[decision.confidence]}>
          {decision.confidence} confidence
        </Badge>
        <Badge variant="outline">{URGENCY_LABEL[decision.urgency]}</Badge>
        {decision.approvalRequired ? (
          <Badge variant="warning">
            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
            Approval required
          </Badge>
        ) : (
          <Badge variant="secondary">Informational</Badge>
        )}
      </div>

      <p className="text-sm text-muted-foreground">{decision.summary}</p>

      {Object.keys(decision.supportingMetrics).length > 0 ? (
        <dl className="grid grid-cols-2 gap-2 text-sm">
          {Object.entries(decision.supportingMetrics).map(([key, value]) => (
            <div key={key} className="rounded-md bg-muted/40 px-3 py-2">
              <dt className="text-xs text-muted-foreground">{humanizeMetric(key)}</dt>
              <dd className="font-medium tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      <p className="text-sm font-medium">{decision.recommendedAction.label}</p>

      <Button
        variant="outline"
        className="self-start"
        onClick={onOpenEvidence}
        aria-label={`View evidence for ${decision.title}`}
      >
        View evidence
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </article>
  );
}

function EvidenceDrawer({ decision, onClose }: { decision: Decision; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close evidence"
        onClick={onClose}
        className="flex-1 bg-background/70 backdrop-blur-sm"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
        className="h-full w-full max-w-md overflow-y-auto border-l bg-card p-5 shadow-lg sm:w-[28rem]"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="evidence-drawer-title" className="text-lg font-semibold">
            {decision.title}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close evidence">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>

        <p className="mt-2 text-sm text-muted-foreground">{decision.summary}</p>

        <section className="mt-5">
          <h3 className="text-sm font-medium">Evidence</h3>
          {decision.evidence.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              This decision is derived from context metadata rather than individual records.
            </p>
          ) : (
            <ul className="mt-2 space-y-2">
              {decision.evidence.map((item) => (
                <li key={item.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium">{item.label}</span>
                    <Badge variant={PRIORITY_VARIANT[item.priority]}>{item.priority}</Badge>
                  </div>
                  {item.occurredAt ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(item.occurredAt).toLocaleString()}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-5 space-y-2 text-sm">
          <h3 className="font-medium">Why this decision</h3>
          <p className="text-muted-foreground">{decision.explainability.priorityReason}</p>
          <p className="text-muted-foreground">{decision.explainability.confidenceReason}</p>
          <p className="text-muted-foreground">{decision.explainability.riskReason}</p>
          <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
            <div className="flex gap-2">
              <dt className="font-medium">Rule</dt>
              <dd>
                {decision.explainability.ruleId} v{decision.explainability.ruleVersion}
              </dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Insights used</dt>
              <dd>{decision.insightIdsUsed.join(", ") || "none"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Context sources</dt>
              <dd>{decision.contextSourcesUsed.join(", ") || "none"}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="font-medium">Required permissions</dt>
              <dd>{decision.requiredPermissions.join(", ") || "none"}</dd>
            </div>
          </dl>
        </section>

        {decision.explainability.permissionLimitations.length > 0 ? (
          <section className="mt-5 text-sm">
            <h3 className="font-medium">Visibility limits</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
              {decision.explainability.permissionLimitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="mt-5 rounded-md border p-3 text-sm">
          <h3 className="font-medium">Recommended action</h3>
          <p className="mt-1 text-muted-foreground">{decision.recommendedAction.label}</p>
          <p className="mt-2 flex items-center gap-2 text-xs">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {decision.approvalRequired
              ? "Requires approval before anything changes."
              : "Informational only — nothing to approve."}
          </p>
        </section>
      </aside>
    </div>
  );
}
