"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, RefreshCw, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  businessIntelligenceApi,
  type BiResult,
  type BiScore,
  type BiStatus,
} from "@/lib/api/business-intelligence";

const STATUS_LABEL: Record<BiStatus, string> = {
  healthy: "Healthy",
  watch: "Watch",
  at_risk: "At risk",
  unavailable: "Unavailable",
};

type BadgeVariant = "success" | "warning" | "destructive" | "info" | "secondary" | "outline";

const STATUS_VARIANT: Record<BiStatus, BadgeVariant> = {
  healthy: "success",
  watch: "warning",
  at_risk: "destructive",
  unavailable: "secondary",
};

const PRIORITY_VARIANT: Record<string, BadgeVariant> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "secondary",
};

/** Everything a score contributes to local search, flattened once. */
function searchCorpus(score: BiScore): string {
  return [
    score.label,
    score.category,
    score.id,
    score.reasoning,
    score.formula,
    score.status,
    score.sourceModules.join(" "),
    score.excludedSources.map((entry) => `${entry.source} ${entry.reason}`).join(" "),
    score.evidence.map((item) => item.label).join(" "),
    Object.keys(score.inputs).join(" "),
  ]
    .join(" ")
    .toLowerCase();
}

function ScoreDial({ score, status }: { score: number | null; status: BiStatus }) {
  const display = score === null ? "—" : String(score);
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-3xl font-semibold tabular-nums" aria-hidden>
        {display}
      </span>
      {score !== null ? <span className="text-sm text-muted-foreground">/ 100</span> : null}
      <span className="sr-only">
        {score === null
          ? `Score unavailable, status ${STATUS_LABEL[status]}`
          : `Score ${score} out of 100, status ${STATUS_LABEL[status]}`}
      </span>
    </div>
  );
}



function ScoreCard({
  score,
  onOpenEvidence,
  headingLevel = "h3",
}: {
  score: BiScore;
  onOpenEvidence: (score: BiScore) => void;
  headingLevel?: "h2" | "h3";
}) {
  const Heading = headingLevel;
  return (
    <article
      className="flex min-w-0 flex-col gap-3 rounded-lg border bg-card p-4 shadow-sm"
      aria-labelledby={`bi-${score.id}-title`}
      data-testid={`bi-card-${score.id}`}
      data-status={score.status}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <Heading id={`bi-${score.id}-title`} className="min-w-0 truncate font-medium">
          {score.label}
        </Heading>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant={STATUS_VARIANT[score.status]}>{STATUS_LABEL[score.status]}</Badge>
          <Badge variant="outline">{score.confidence} confidence</Badge>
        </div>
      </header>

      <ScoreDial score={score.score} status={score.status} />

      <p className="text-sm text-muted-foreground">{score.reasoning}</p>

      <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Formula</dt>
          <dd className="font-medium text-foreground">v{score.formulaVersion}</dd>
        </div>
        <div className="flex min-w-0 gap-1">
          <dt>Sources</dt>
          <dd className="truncate font-medium text-foreground">
            {score.sourceModules.join(", ") || "—"}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Evidence</dt>
          <dd className="font-medium text-foreground">{score.evidence.length}</dd>
        </div>
      </dl>

      {score.excludedSources.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          Excluded:{" "}
          {score.excludedSources.map((entry) => `${entry.source} (${entry.reason})`).join(", ")}
        </p>
      ) : null}

      <div className="mt-auto">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onOpenEvidence(score)}
          data-testid={`bi-evidence-open-${score.id}`}
        >
          View evidence &amp; formula
        </Button>
      </div>
    </article>
  );
}

function EvidenceDrawer({ score, onClose }: { score: BiScore; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/40"
      onClick={onClose}
      data-testid="bi-evidence-backdrop"
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="bi-drawer-title"
        className="flex h-full w-full max-w-md flex-col overflow-y-auto border-l bg-background p-4 shadow-xl sm:p-6"
        onClick={(event) => event.stopPropagation()}
        data-testid="bi-evidence-drawer"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="bi-drawer-title" className="text-lg font-semibold">
            {score.label}
          </h2>
          <Button
            size="sm"
            variant="ghost"
            onClick={onClose}
            aria-label="Close evidence drawer"
            data-testid="bi-evidence-close"
            autoFocus
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>

        <section className="mt-4 space-y-1" aria-labelledby="bi-drawer-formula">
          <h3 id="bi-drawer-formula" className="text-sm font-medium">
            Formula (version {score.formulaVersion})
          </h3>
          <p className="text-sm text-muted-foreground">{score.formula}</p>
          <ul className="mt-1 space-y-0.5 text-sm text-muted-foreground">
            {Object.entries(score.weights).map(([key, weight]) => (
              <li key={key}>
                {key}: <span className="tabular-nums text-foreground">{weight}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-4 space-y-1" aria-labelledby="bi-drawer-reasoning">
          <h3 id="bi-drawer-reasoning" className="text-sm font-medium">
            Reasoning
          </h3>
          <p className="text-sm text-muted-foreground">{score.reasoning}</p>
          <p className="text-sm text-muted-foreground">Confidence: {score.confidence}</p>
        </section>

        <section className="mt-4 space-y-1" aria-labelledby="bi-drawer-inputs">
          <h3 id="bi-drawer-inputs" className="text-sm font-medium">
            Inputs
          </h3>
          {Object.keys(score.inputs).length > 0 ? (
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {Object.entries(score.inputs).map(([key, value]) => (
                <li key={key} className="break-words">
                  {key}: <span className="tabular-nums text-foreground">{value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No inputs — the source is unavailable.</p>
          )}
        </section>

        <section className="mt-4 space-y-1" aria-labelledby="bi-drawer-evidence">
          <h3 id="bi-drawer-evidence" className="text-sm font-medium">
            Evidence ({score.evidence.length})
          </h3>
          {score.evidence.length > 0 ? (
            <ul className="space-y-1.5">
              {score.evidence.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <Badge variant={PRIORITY_VARIANT[item.priority] ?? "secondary"}>{item.priority}</Badge>
                  <span className="min-w-0 break-words text-muted-foreground">{item.label}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No permitted records.</p>
          )}
        </section>

        <section className="mt-4 space-y-1" aria-labelledby="bi-drawer-excluded">
          <h3 id="bi-drawer-excluded" className="text-sm font-medium">
            Excluded sources
          </h3>
          {score.excludedSources.length > 0 ? (
            <ul className="space-y-0.5 text-sm text-muted-foreground">
              {score.excludedSources.map((entry) => (
                <li key={`${entry.source}:${entry.reason}`}>
                  {entry.source} — {entry.reason}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">None.</p>
          )}
        </section>
      </aside>
    </div>
  );
}

export default function BusinessIntelligencePage() {
  const [search, setSearch] = useState("");
  const [drawerScore, setDrawerScore] = useState<BiScore | null>(null);

  const query = useQuery<BiResult>({
    queryKey: ["business-intelligence"],
    queryFn: ({ signal }) => businessIntelligenceApi.get(signal),
    staleTime: 30_000,
  });

  // Search is purely local over the already-cached response — no second
  // request, and no score is recomputed here.
  const departments = useMemo(() => {
    const term = search.trim().toLowerCase();
    const all = query.data?.departments ?? [];
    if (term === "") return all;
    return all.filter((score) => searchCorpus(score).includes(term));
  }, [query.data, search]);

  if (query.isLoading) {
    return (
      <div className="p-4 sm:p-6" aria-busy="true" data-testid="bi-loading">
        <h1 className="text-2xl font-semibold">Business intelligence</h1>
        <p className="mt-2 text-sm text-muted-foreground">Loading business intelligence…</p>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="p-4 sm:p-6" data-testid="bi-error">
        <h1 className="text-2xl font-semibold">Business intelligence</h1>
        <p role="alert" className="mt-2 text-destructive">
          Business intelligence could not be loaded.
        </p>
        <Button className="mt-4" onClick={() => void query.refetch()} data-testid="bi-retry">
          Retry
        </Button>
      </div>
    );
  }

  const data = query.data;
  const executive = data?.executiveHealth;

  return (
    <div
      className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 sm:p-6"
      data-testid="bi-page"
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Business intelligence</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic health scores computed server-side from verified records.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
          aria-label="Refresh business intelligence"
          data-testid="bi-refresh"
        >
          <RefreshCw
            className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </Button>
      </header>

      <div
        role="status"
        className="flex items-start gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground"
        data-testid="bi-history-banner"
      >
        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
        <span>
          Historical trends are unavailable — no verified historical source is exposed, so no
          trend is inferred.
        </span>
      </div>

      {executive ? (
        <section aria-labelledby="bi-executive-heading" className="space-y-3">
          <h2 id="bi-executive-heading" className="text-lg font-semibold">
            Executive health
          </h2>
          <ScoreCard score={executive} onOpenEvidence={setDrawerScore} headingLevel="h3" />
          <p className="text-sm text-muted-foreground" data-testid="bi-executive-summary">
            {executive.score === null
              ? "No permitted verified department source is available, so no executive score is shown."
              : `Executive health is ${executive.score} out of 100 (${STATUS_LABEL[executive.status]}), averaged across ${
                  (data?.departments ?? []).filter((item) => item.score !== null).length
                } permitted department score(s).`}
          </p>
        </section>
      ) : null}

      <section aria-labelledby="bi-departments-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="bi-departments-heading" className="text-lg font-semibold">
            Department health
          </h2>
          <div className="relative min-w-0 flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <label className="sr-only" htmlFor="bi-search">
              Search departments, evidence, formulas, reasoning and sources
            </label>
            <input
              id="bi-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search departments, evidence, sources"
              className="h-9 w-full rounded-md border bg-background pl-8 pr-3 text-sm"
              data-testid="bi-search"
            />
          </div>
        </div>

        {departments.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3" data-testid="bi-departments">
            {departments.map((score) => (
              <ScoreCard key={score.id} score={score} onOpenEvidence={setDrawerScore} />
            ))}
          </div>
        ) : (
          <div
            className="rounded-lg border p-8 text-center text-sm text-muted-foreground"
            data-testid="bi-empty"
          >
            <AlertTriangle className="mx-auto mb-2 h-5 w-5" aria-hidden />
            {(data?.departments ?? []).length === 0
              ? "No department scores are available."
              : "No departments match your search."}
          </div>
        )}
      </section>

      {data && data.excludedSources.length > 0 ? (
        <aside
          className="text-sm text-muted-foreground"
          aria-label="Excluded sources"
          data-testid="bi-excluded"
        >
          Unavailable sources:{" "}
          {data.excludedSources.map((entry) => `${entry.source} (${entry.reason})`).join(", ")}
        </aside>
      ) : null}

      {drawerScore ? (
        <EvidenceDrawer score={drawerScore} onClose={() => setDrawerScore(null)} />
      ) : null}
    </div>
  );
}
