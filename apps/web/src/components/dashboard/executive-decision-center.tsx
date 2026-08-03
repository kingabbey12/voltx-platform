"use client";

import { AlertTriangle, ArrowUpRight, CircleCheckBig, Lightbulb, ListChecks, ShieldAlert } from "lucide-react";
import { RecommendationDecisionCard } from "@/components/dashboard/recommendation-decision-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardRecommendations } from "@/hooks/use-dashboard";
import type { DashboardRecommendation } from "@/lib/api/dashboard";

type DecisionGroup = {
  id: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  icon: typeof ListChecks;
  accent: string;
  filter: (recommendation: DashboardRecommendation) => boolean;
};

const groups: DecisionGroup[] = [
  {
    id: "executive-priorities",
    title: "Executive priorities",
    description: "Verified decisions that need an owner or an approval.",
    emptyTitle: "No verified decisions are waiting",
    emptyDescription: "Voltx will add a priority when the existing recommendation engine exposes one.",
    icon: ListChecks,
    accent: "text-primary",
    filter: (recommendation) => recommendation.status === "OPEN" && recommendation.severity !== "OPPORTUNITY",
  },
  {
    id: "executive-risks",
    title: "Executive risks",
    description: "Only warnings and critical recommendations already supported by workspace evidence.",
    emptyTitle: "No evidence-backed risks are currently exposed",
    emptyDescription: "Deal inactivity, workflow failures, communications backlog, and approval bottlenecks need a supporting recommendation or aggregate data before they can appear here.",
    icon: ShieldAlert,
    accent: "text-warning",
    filter: (recommendation) => recommendation.status === "OPEN" && (recommendation.severity === "WARNING" || recommendation.severity === "CRITICAL"),
  },
  {
    id: "executive-opportunities",
    title: "Executive opportunities",
    description: "Growth signals are shown only when the existing recommendation engine marks them as opportunities.",
    emptyTitle: "No evidence-backed opportunities are currently exposed",
    emptyDescription: "Voltx needs a verified opportunity recommendation before it can claim an upsell, conversion, engagement, or automation win.",
    icon: Lightbulb,
    accent: "text-success",
    filter: (recommendation) => recommendation.status === "OPEN" && recommendation.severity === "OPPORTUNITY",
  },
];

export function ExecutiveDecisionCenter() {
  const { data: recommendations = [], isLoading, isError } = useDashboardRecommendations();

  return <section className="scroll-mt-24" aria-labelledby="decision-center-title">
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">Decision intelligence</p>
        <h2 id="decision-center-title" className="mt-1 text-2xl font-semibold tracking-tight">What needs executive attention.</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Every item is a persisted recommendation with visible reasoning, evidence, freshness, and only the actions Voltx can actually perform.</p>
      </div>
      <span className="inline-flex w-fit items-center gap-1.5 text-xs text-muted-foreground"><CircleCheckBig className="h-3.5 w-3.5 text-success" aria-hidden />No inferred decisions</span>
    </div>

    {isLoading && <div className="grid gap-4 xl:grid-cols-3">{groups.map((group) => <section key={group.id} className="surface-card min-h-72 rounded-[24px] p-5"><Skeleton className="h-5 w-40" /><Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-6 h-32 w-full" /></section>)}</div>}
    {!isLoading && isError && <div role="alert" className="surface-card rounded-[24px] p-6"><AlertTriangle className="h-5 w-5 text-warning" aria-hidden /><h3 className="mt-3 font-semibold">Decision intelligence is temporarily unavailable</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">Your existing records are unchanged. Voltx will retry the recommendation feed before presenting executive decisions.</p></div>}
    {!isLoading && !isError && <div className="grid gap-4 xl:grid-cols-3">{groups.map((group) => <DecisionColumn key={group.id} group={group} recommendations={recommendations.filter(group.filter)} />)}</div>}
  </section>;
}

function DecisionColumn({ group, recommendations }: { group: DecisionGroup; recommendations: DashboardRecommendation[] }) {
  const Icon = group.icon;
  return <section id={group.id} className="surface-card flex min-h-72 flex-col rounded-[24px] p-5" aria-labelledby={`${group.id}-title`}>
    <div className="flex items-start justify-between gap-3"><div><div className="flex items-center gap-2"><Icon className={`h-4 w-4 ${group.accent}`} aria-hidden /><h3 id={`${group.id}-title`} className="font-semibold">{group.title}</h3></div><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{group.description}</p></div><span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-2 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">{recommendations.length}</span></div>
    {recommendations.length === 0 ? <div className="my-auto pt-8"><p className="text-sm font-medium">{group.emptyTitle}</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{group.emptyDescription}</p></div> : <div className="mt-4 space-y-2.5">{recommendations.slice(0, 3).map((recommendation) => <RecommendationDecisionCard key={recommendation.id} recommendation={recommendation} />)}</div>}
    {recommendations.length > 3 && <p className="mt-4 inline-flex items-center gap-1 text-xs text-muted-foreground">{recommendations.length - 3} more supported decisions <ArrowUpRight className="h-3.5 w-3.5" aria-hidden /></p>}
  </section>;
}