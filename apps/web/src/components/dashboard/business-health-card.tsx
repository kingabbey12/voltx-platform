"use client";

import { ArrowUpRight, CheckCircle2, CircleDashed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import { cn } from "@/lib/utils";

export function BusinessHealthCard() {
  const { data, isLoading, isError } = useDashboardMetrics();
  const health = data?.health;
  const historyDays = data?.meta.historyDays ?? 0;
  const available = health?.score !== null && health?.score !== undefined;
  const progress = Math.min((historyDays / 30) * 100, 100);

  return (
    <section className="surface-widget flex h-full min-h-[300px] flex-col rounded-[24px] p-5 sm:p-6" aria-labelledby="business-health-title">
      <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-success">Baseline</p><h2 id="business-health-title" className="mt-1 text-xl font-semibold tracking-tight">Business health</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl border border-success/20 bg-success/[0.08] text-success shadow-[0_10px_24px_-16px_hsl(var(--success)/0.85)]"><CheckCircle2 className="h-4 w-4" /></span></div>
      {isLoading && <div className="mt-6 flex flex-1 items-center gap-5"><Skeleton className="h-28 w-28 rounded-full" /><div className="flex-1 space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div></div>}
      {!isLoading && isError && <p className="mt-6 text-sm leading-relaxed text-muted-foreground">Health analysis is temporarily unavailable. Your business metrics remain available above.</p>}
      {!isLoading && !isError && available && <div className="mt-6 flex flex-1 flex-col"><div className="flex items-center gap-5"><div className="relative grid h-28 w-28 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(145 100% 39%) ${(health.score ?? 0) * 3.6}deg, hsl(0 0% 100% / 0.07) 0deg)` }}><div className="grid h-[92px] w-[92px] place-items-center rounded-full bg-card"><span className="text-3xl font-semibold tabular-nums">{health.score}</span><span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">score</span></div></div><div><p className="text-sm font-medium capitalize">{health.status}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">Your score is based on active business signals, not a generic benchmark.</p></div></div>{health.factors?.length ? <div className="mt-5 space-y-2">{health.factors.slice(0, 3).map((factor) => <div key={factor.label} className="flex items-center justify-between text-xs"><span className="text-muted-foreground">{factor.label}</span><span className={cn("capitalize", factor.impact === "positive" ? "text-success" : factor.impact === "negative" ? "text-destructive" : "text-muted-foreground")}>{factor.impact}</span></div>)}</div> : null}</div>}
      {!isLoading && !isError && !available && <div className="mt-6 flex flex-1 flex-col"><div className="flex items-center gap-4"><div className="relative grid h-20 w-20 place-items-center rounded-full border border-success/20 bg-success/[0.06] shadow-[0_0_30px_-12px_hsl(var(--success)/0.75)]"><CircleDashed className="h-8 w-8 animate-[spin_8s_linear_infinite] text-success/80" /></div><div><p className="text-sm font-semibold">Building your business baseline</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">A useful health score needs enough of your own history to compare against.</p></div></div><div className="mt-auto pt-6"><div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]"><div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--success)),hsl(145_100%_58%))] transition-[width] duration-500" style={{ width: `${progress}%` }} /></div><p className="mt-2 text-xs text-muted-foreground">{historyDays} of 30 days collected</p></div></div>}
      <a href="/dashboard" className="mt-4 inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">Full analysis when ready <ArrowUpRight className="h-3.5 w-3.5" /></a>
    </section>
  );
}