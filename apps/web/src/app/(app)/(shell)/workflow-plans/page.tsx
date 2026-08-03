"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ClipboardList,
  Clock,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  workflowPlansApi,
  type WorkflowPlan,
  type WorkflowPlanStatus,
} from "@/lib/api/workflow-plans";

const REFRESH_INTERVAL_MS = 60_000;

const STATUS_LABEL: Record<WorkflowPlanStatus, string> = {
  awaiting_approval: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
  handed_off: "Handed off",
};

const STATUS_TONE: Record<WorkflowPlanStatus, string> = {
  awaiting_approval: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/15 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  expired: "bg-muted text-muted-foreground",
  handed_off: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
};

const FALLBACK_TONE = "bg-muted text-muted-foreground";

const LEVEL_TONE: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  medium: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  low: "bg-muted text-muted-foreground",
};

function Badge({
  children,
  tone,
  label,
}: {
  children: React.ReactNode;
  tone: string;
  label: string;
}) {
  return (
    <span
      className={`rounded px-2 py-0.5 text-xs font-medium ${tone}`}
      aria-label={`${label}: ${String(children)}`}
    >
      {children}
    </span>
  );
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function PlanCard({
  plan,
  onSubmit,
  onCancel,
  onHandOff,
  busy,
  error,
}: {
  plan: WorkflowPlan;
  onSubmit: (id: string) => void;
  onCancel: (id: string) => void;
  onHandOff: (plan: WorkflowPlan) => void;
  busy: boolean;
  error: string | null;
}) {
  const [open, setOpen] = useState(false);
  const detailsId = `plan-details-${plan.id}`;
  const body = plan.plan;

  return (
    <article className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{body.title}</h2>
          <p className="text-xs text-muted-foreground">{body.category}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={STATUS_TONE[plan.status]} label="Status">
            {STATUS_LABEL[plan.status]}
          </Badge>
          <Badge tone={LEVEL_TONE[body.priority] ?? FALLBACK_TONE} label="Priority">
            {body.priority}
          </Badge>
          <Badge tone={LEVEL_TONE[body.risk] ?? FALLBACK_TONE} label="Risk">
            risk {body.risk}
          </Badge>
          <Badge tone={LEVEL_TONE.medium ?? FALLBACK_TONE} label="Confidence">
            {body.confidence} confidence
          </Badge>
          <Badge tone={STATUS_TONE.awaiting_approval} label="Approval">
            Approval required
          </Badge>
        </div>
      </header>

      <p className="text-sm text-muted-foreground">{body.summary}</p>
      <p className="text-sm">
        <span className="text-muted-foreground">Objective: </span>
        {body.objective}
      </p>

      <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <div className="flex gap-1">
          <dt>Estimated</dt>
          <dd className="font-medium text-foreground">{body.estimatedDurationMinutes} min</dd>
        </div>
        <div className="flex gap-1">
          <dt>Created</dt>
          <dd className="font-medium text-foreground">{formatDate(plan.createdAt)}</dd>
        </div>
        <div className="flex gap-1">
          <dt>Expires</dt>
          <dd className="font-medium text-foreground">{formatDate(plan.expiresAt)}</dd>
        </div>
        {plan.approvalId ? (
          <div className="flex gap-1">
            <dt>Approval</dt>
            <dd className="font-mono text-foreground">{plan.approvalId.slice(0, 8)}</dd>
          </div>
        ) : null}
        {plan.workflowExecutionId ? (
          <div className="flex gap-1">
            <dt>Workflow run</dt>
            <dd className="font-mono text-foreground">
              {plan.workflowExecutionId.slice(0, 8)}
            </dd>
          </div>
        ) : null}
      </dl>

      <ol className="space-y-1 text-sm">
        {body.steps.map((step) => (
          <li key={step.key} className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">{step.order}.</span>
            <span>{step.title}</span>
            <span className="text-xs text-muted-foreground">({step.type})</span>
          </li>
        ))}
      </ol>

      <div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
        >
          <ChevronDown
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
          {open ? "Hide" : "Open"} details
        </button>
        <div id={detailsId} hidden={!open} className="mt-2 space-y-2 border-l pl-3 text-sm">
          <p>
            <span className="text-muted-foreground">Required roles: </span>
            {body.requiredRoles.join(", ") || "—"}
          </p>
          <p className="break-words">
            <span className="text-muted-foreground">Required permissions: </span>
            {body.requiredPermissions.join(", ") || "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Context sources: </span>
            {body.contextSources.join(", ") || "—"}
          </p>
          <div>
            <p className="text-muted-foreground">Decision evidence</p>
            <ul className="mt-1 space-y-1">
              {body.evidence.length > 0 ? (
                body.evidence.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2">
                    <Badge tone={LEVEL_TONE[item.priority] ?? FALLBACK_TONE} label="Record priority">
                      {item.priority}
                    </Badge>
                    <span className="text-muted-foreground">{item.label}</span>
                  </li>
                ))
              ) : (
                <li className="text-muted-foreground">No permitted records.</li>
              )}
            </ul>
          </div>
          <p className="break-words">
            <span className="text-muted-foreground">Insight evidence: </span>
            {body.insightIds.join(", ") || "—"}
          </p>
          <p className="text-muted-foreground">{body.explainability.approvalReason}</p>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {plan.status === "awaiting_approval" && !plan.approvalId ? (
          <Button size="sm" onClick={() => onSubmit(plan.id)} disabled={busy}>
            Submit for approval
          </Button>
        ) : null}
        {plan.approvalId ? (
          <Button size="sm" variant="outline" asChild>
            <a href={`/ai/operator?approval=${plan.approvalId}`}>View approval</a>
          </Button>
        ) : null}
        {plan.status === "approved" ? (
          <Button size="sm" onClick={() => onHandOff(plan)} disabled={busy}>
            Hand off approved plan
          </Button>
        ) : null}
        {["awaiting_approval", "approved"].includes(plan.status) ? (
          <Button size="sm" variant="outline" onClick={() => onCancel(plan.id)} disabled={busy}>
            Cancel
          </Button>
        ) : null}
      </div>
    </article>
  );
}

export default function WorkflowPlansPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const query = useQuery<WorkflowPlan[]>({
    queryKey: ["workflow-plans"],
    queryFn: ({ signal }) => workflowPlansApi.list(signal),
    refetchInterval: REFRESH_INTERVAL_MS,
    refetchOnWindowFocus: true,
  });

  const invalidate = () =>
    void queryClient.invalidateQueries({ queryKey: ["workflow-plans"] });

  const recordError = (id: string, error: unknown) =>
    setActionError((current) => ({
      ...current,
      [id]: error instanceof Error ? error.message : "The action could not be completed.",
    }));

  const generateMutation = useMutation({
    mutationFn: () => workflowPlansApi.generate("Create a plan for today's priorities."),
    onSuccess: invalidate,
  });
  const submitMutation = useMutation({
    mutationFn: (id: string) => workflowPlansApi.submit(id),
    onSuccess: invalidate,
    onError: (error, id) => recordError(id, error),
  });
  const cancelMutation = useMutation({
    mutationFn: (id: string) => workflowPlansApi.cancel(id),
    onSuccess: invalidate,
    onError: (error, id) => recordError(id, error),
  });
  const handoffMutation = useMutation({
    mutationFn: (plan: WorkflowPlan) => workflowPlansApi.handOff(plan.id, plan.planVersion),
    onSuccess: invalidate,
    onError: (error, plan) => recordError(plan.id, error),
  });

  const busy =
    submitMutation.isPending || cancelMutation.isPending || handoffMutation.isPending;

  const plans = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (query.data ?? []).filter(
      (plan) =>
        (statusFilter === "all" || plan.status === statusFilter) &&
        (term === "" ||
          `${plan.plan.title} ${plan.plan.summary} ${plan.plan.objective}`
            .toLowerCase()
            .includes(term)),
    );
  }, [query.data, search, statusFilter]);

  if (query.isLoading) {
    return (
      <div className="p-6" aria-busy="true">
        <p className="text-sm text-muted-foreground">Loading workflow plans…</p>
      </div>
    );
  }

  if (query.error) {
    return (
      <div className="p-6" role="alert">
        <p className="text-destructive">Workflow plans could not be loaded.</p>
        <Button className="mt-4" onClick={() => void query.refetch()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 overflow-x-hidden p-4 sm:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workflow plans</h1>
          <p className="text-sm text-muted-foreground">
            Deterministic plans derived from executive decisions. Nothing runs until a human
            approves it.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => void query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh workflow plans"
          >
            <RefreshCw
              className={`h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
              aria-hidden
            />
            Refresh
          </Button>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
          >
            <ClipboardList className="h-4 w-4" aria-hidden />
            Generate plans
          </Button>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <label className="sr-only" htmlFor="plan-search">
          Search plans
        </label>
        <input
          id="plan-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search plans"
          className="h-9 min-w-0 flex-1 rounded-md border bg-background px-3 text-sm sm:flex-none"
        />
        <label className="sr-only" htmlFor="plan-status">
          Filter by status
        </label>
        <select
          id="plan-status"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All statuses</option>
          {Object.entries(STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {generateMutation.error ? (
        <p role="alert" className="text-sm text-destructive">
          Plans could not be generated.
        </p>
      ) : null}

      {plans.length > 0 ? (
        <section aria-label="Workflow plans" className="grid gap-4 md:grid-cols-2">
          {plans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              busy={busy}
              error={actionError[plan.id] ?? null}
              onSubmit={(id) => submitMutation.mutate(id)}
              onCancel={(id) => cancelMutation.mutate(id)}
              onHandOff={(entry) => handoffMutation.mutate(entry)}
            />
          ))}
        </section>
      ) : (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          {query.data?.length ? (
            <>
              <AlertTriangle className="mx-auto mb-2 h-5 w-5" aria-hidden />
              No plans match the selected filters.
            </>
          ) : (
            <>
              <Clock className="mx-auto mb-2 h-5 w-5" aria-hidden />
              No workflow plans yet. Generate a set to get started.
            </>
          )}
        </div>
      )}

      <aside className="flex items-center gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
        Plans are recommendations. Approved plans are handed to the workflow engine, which owns
        execution.
      </aside>
    </div>
  );
}
