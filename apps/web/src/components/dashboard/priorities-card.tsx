"use client";

import { CircleCheckBig, Sparkles } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { RecommendationDecisionCard } from "@/components/dashboard/recommendation-decision-card";
import { useDashboardRecommendations } from "@/hooks/use-dashboard";

export function PrioritiesCard() {
  const { data: recommendations = [], isLoading, isError } = useDashboardRecommendations();
  return (
    <section id="priorities" className="surface flex h-full min-h-[280px] flex-col p-5" aria-labelledby="priorities-title">
      <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-warning">Decision queue</p><h2 id="priorities-title" className="mt-1 text-lg font-semibold">Priorities</h2></div><Sparkles className="h-5 w-5 text-[hsl(268_83%_72%)]" /></div>
      {isLoading && <div className="mt-5 space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>}
      {!isLoading && isError && <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Priorities are temporarily unavailable. Voltx will retry automatically.</p>}
      {!isLoading && !isError && recommendations.length === 0 && <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-success/10 text-success"><CircleCheckBig className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium">You&apos;re caught up</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">No high-priority actions require your attention today.</p></div>}
      {!isLoading && !isError && recommendations.length > 0 && <div className="mt-5 space-y-2.5">{recommendations.slice(0, 2).map((recommendation) => <RecommendationDecisionCard key={recommendation.id} recommendation={recommendation} />)}</div>}
    </section>
  );
}