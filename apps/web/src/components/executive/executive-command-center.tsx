"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RefreshCw, Search, ShieldCheck, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decisionsApi } from "@/lib/api/decisions";
import { insightsApi } from "@/lib/api/insights";
import { opportunitiesApi } from "@/lib/api/sales";
import { workflowPlansApi } from "@/lib/api/workflow-plans";
import { workflowsApi } from "@/lib/api/workflows";

const SEARCH_DEBOUNCE_MS = 250;

type SearchResult = {
  group: "Decision" | "Workflow plan" | "Opportunity";
  id: string;
  title: string;
  href: string;
};

function Section({ title, loading, error, retry, children }: { title: string; loading: boolean; error: boolean; retry: () => void; children: React.ReactNode }) {
  const headingId = `executive-${title.toLowerCase().replaceAll(" ", "-")}`;

  return <section aria-labelledby={headingId} className="rounded-xl border bg-card p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={headingId} className="font-semibold">{title}</h2>
      {error && <Button variant="outline" size="sm" aria-label={`Retry ${title}`} onClick={retry}>Retry</Button>}
    </div>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Loading {title}…</p> : error ? <p role="alert" className="text-sm text-destructive">{title} is unavailable; other sections remain available.</p> : children}
  </section>;
}

export function ExecutiveCommandCenter() {
  const router = useRouter();
  const searchInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeResult, setActiveResult] = useState(0);

  // Section failures are independently recoverable. Automatic retries would
  // create duplicate dashboard traffic and obscure the explicit Retry action.
  const decisions = useQuery({ queryKey: ["ai", "decisions"], queryFn: () => decisionsApi.get(), retry: false });
  const insights = useQuery({ queryKey: ["executive-insights"], queryFn: insightsApi.get, retry: false });
  const plans = useQuery({ queryKey: ["ai", "workflow-plans"], queryFn: () => workflowPlansApi.list(), retry: false });
  const approvals = useQuery({ queryKey: ["workflows", "approvals", 1, 20], queryFn: () => workflowsApi.listApprovals(), retry: false });
  const opportunities = useQuery({ queryKey: ["sales", "opportunities", "executive"], queryFn: () => opportunitiesApi.list({ limit: 10 }), retry: false });

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const results = useMemo<SearchResult[]>(() => {
    const normalizedSearch = debouncedSearch.toLocaleLowerCase();
    const matches = (title: string) => title.toLocaleLowerCase().includes(normalizedSearch);
    return [
      ...(decisions.data?.decisions ?? []).map((decision) => ({ group: "Decision" as const, id: decision.id, title: decision.title, href: "/executive-decisions" })),
      ...(plans.data ?? []).map((plan) => ({ group: "Workflow plan" as const, id: plan.id, title: plan.plan.title, href: "/workflow-plans" })),
      ...(opportunities.data?.items ?? []).map((opportunity) => ({ group: "Opportunity" as const, id: opportunity.id, title: opportunity.title, href: `/crm/opportunities/${opportunity.id}` })),
    ].filter((result) => matches(result.title)).slice(0, 8);
  }, [debouncedSearch, decisions.data, opportunities.data, plans.data]);

  useEffect(() => setActiveResult(0), [debouncedSearch]);

  const refresh = () => {
    void decisions.refetch();
    void insights.refetch();
    void plans.refetch();
    void approvals.refetch();
    void opportunities.refetch();
  };
  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    searchInput.current?.focus();
  };
  const selectResult = (result: SearchResult) => {
    clearSearch();
    router.push(result.href);
  };
  const onSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (!search) return;
    if (event.key === "Escape") {
      event.preventDefault();
      clearSearch();
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResult((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResult((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && results[activeResult]) {
      event.preventDefault();
      selectResult(results[activeResult]);
    }
  };

  return <div data-executive-command-center className="mx-auto max-w-7xl space-y-5 p-4 pb-20 sm:p-6">
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div><h1 className="text-2xl font-semibold">Executive Command Center</h1><p className="text-sm text-muted-foreground">Verified context, insights, decisions, and approval-aware plans.</p></div>
      <Button variant="outline" aria-label="Refresh Executive Command Center" onClick={refresh}><RefreshCw className="h-4 w-4" aria-hidden />Refresh</Button>
    </header>
    <div className="relative">
      <label htmlFor="executive-search" className="sr-only">Search Command Center</label>
      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" aria-hidden />
      <input ref={searchInput} id="executive-search" role="combobox" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={onSearchKeyDown} aria-autocomplete="list" aria-controls="executive-search-results" aria-expanded={Boolean(search)} aria-activedescendant={search && results[activeResult] ? `executive-search-result-${results[activeResult].group}-${results[activeResult].id}` : undefined} placeholder="Search permitted decisions, plans, and opportunities" className="h-10 w-full border bg-background py-2 pl-9 pr-10 text-sm" />
      {search && <Button type="button" variant="ghost" size="icon" aria-label="Clear Command Center search" onClick={clearSearch} className="absolute right-1 top-1 h-8 w-8"><X className="h-4 w-4" aria-hidden /></Button>}
      {search && <div id="executive-search-results" role="listbox" aria-label="Command Center search results" className="mt-1 max-h-72 overflow-y-auto rounded-md border bg-popover p-1 text-sm shadow-sm">
        {results.length ? results.map((result, index) => <button key={`${result.group}-${result.id}`} id={`executive-search-result-${result.group}-${result.id}`} type="button" role="option" aria-selected={index === activeResult} onMouseEnter={() => setActiveResult(index)} onClick={() => selectResult(result)} className="flex w-full items-center gap-2 rounded px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"><span className="text-xs text-muted-foreground">{result.group}</span><span>{result.title}</span></button>) : <p className="px-3 py-2 text-muted-foreground">No permitted results found.</p>}
      </div>}
    </div>
    <Section title="Executive Summary" loading={insights.isLoading} error={insights.isError} retry={() => insights.refetch()}><p className="text-sm">{insights.data?.insights.length ?? 0} evidence-backed insights.</p><p className="text-xs text-muted-foreground">Last refreshed: {insights.data?.generatedAt ? new Date(insights.data.generatedAt).toLocaleString() : "Unavailable"}</p></Section>
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Decision Center" loading={decisions.isLoading} error={decisions.isError} retry={() => decisions.refetch()}>{decisions.data?.decisions.slice(0, 5).map((decision) => <article key={decision.id} className="border-l-2 border-primary pl-3"><p className="font-medium">{decision.title}</p><p className="text-sm">{decision.priority} · {decision.confidence} · {decision.riskLevel} risk</p><p className="text-xs">Evidence: {decision.evidence.map((evidence) => evidence.label).join(", ") || "None"}</p><p className="flex items-center gap-1 text-xs"><ShieldCheck className="h-3.5 w-3.5" aria-hidden />{decision.recommendedAction.label} — approval required</p></article>)}</Section>
      <Section title="Workflow Queue" loading={plans.isLoading} error={plans.isError} retry={() => plans.refetch()}>{plans.data?.slice(0, 5).map((plan) => <article key={plan.id} className="flex gap-2 border-b py-2"><Workflow className="h-4 w-4" aria-hidden /><p>{plan.plan.title} — {plan.status.replaceAll("_", " ")} · Approval: {plan.approvalId ?? "not submitted"}</p></article>)}</Section>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Pending Approvals" loading={approvals.isLoading} error={approvals.isError} retry={() => approvals.refetch()}>{approvals.data?.items.length ? approvals.data.items.map((approval) => <p key={approval.id} className="border-b py-2 text-sm">Approval {approval.id} · {approval.status} · created {new Date(approval.createdAt).toLocaleString()}</p>) : <p className="text-sm text-muted-foreground">No permitted pending workflow approvals.</p>}</Section>
      <Section title="Opportunity Center" loading={opportunities.isLoading} error={opportunities.isError} retry={() => opportunities.refetch()}>{opportunities.data?.items.length ? opportunities.data.items.map((opportunity) => <p key={opportunity.id} className="border-b py-2 text-sm">{opportunity.title} · {opportunity.stage} · {opportunity.probability}%</p>) : <p className="text-sm text-muted-foreground">No permitted opportunities.</p>}</Section>
    </div>
    <div className="grid gap-4 lg:grid-cols-2">
      <Section title="Risk Center" loading={decisions.isLoading} error={decisions.isError} retry={() => decisions.refetch()}>{decisions.data?.decisions.filter((decision) => ["critical", "high"].includes(decision.riskLevel)).map((decision) => <p key={decision.id}><AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden />{decision.category}: {decision.title}</p>)}</Section>
      <Section title="Executive Timeline" loading={decisions.isLoading || plans.isLoading} error={decisions.isError && plans.isError} retry={refresh}>{[...(decisions.data?.decisions ?? []).map((decision) => ({ id: decision.id, date: decision.generatedAt, title: decision.title })), ...(plans.data ?? []).map((plan) => ({ id: plan.id, date: plan.createdAt, title: plan.plan.title }))].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8).map((event) => <p key={event.id} className="border-b py-2 text-sm">{new Date(event.date).toLocaleString()} · {event.title}</p>)}</Section>
    </div>
    <Section title="Department Overview" loading={insights.isLoading} error={insights.isError} retry={() => insights.refetch()}><p className="text-sm text-muted-foreground">Score unavailable — Business Intelligence module not yet implemented.</p></Section>
  </div>;
}
