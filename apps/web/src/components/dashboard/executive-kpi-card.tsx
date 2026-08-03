"use client";

import Link from "next/link";
import { ArrowUpRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { CountUpValue } from "@/components/dashboard/count-up-value";
import { SparklineChart } from "@/components/dashboard/sparkline-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { ACCENTS, type Accent } from "@/lib/design-language";
import { cn } from "@/lib/utils";

export type ExecutiveKpiState = "loading" | "ready" | "empty" | "error";

interface ExecutiveKpiCardProps {
  label: string;
  icon: LucideIcon;
  accent: Accent;
  state: ExecutiveKpiState;
  value?: number;
  format: (value: number) => string;
  trend?: number[];
  change?: { percent: number; comparedTo: string };
  href: string;
  emptyLabel: string;
  emptyDescription: string;
}

export function ExecutiveKpiCard({
  label,
  icon: Icon,
  accent,
  state,
  value,
  format,
  trend,
  change,
  href,
  emptyLabel,
  emptyDescription,
}: ExecutiveKpiCardProps) {
  const tokens = ACCENTS[accent];
  const positive = (change?.percent ?? 0) >= 0;
  const insight = change
    ? `${positive ? "Voltx detected positive momentum" : "Voltx flagged a change in momentum"} ${change.comparedTo}.`
    : state === "empty"
      ? "Voltx will interpret this signal as your workspace becomes active."
      : "Voltx is building the comparison history behind this metric.";
  const recommendedAction = state === "empty" ? emptyLabel : `Review ${label.toLowerCase()}`;

  return (
    <article className="surface-interactive group relative flex min-h-[268px] flex-col overflow-hidden rounded-[24px] p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" style={{ background: `radial-gradient(110% 70% at 100% 0%, hsl(${tokens.hsl} / 0.15), transparent 60%)` }} />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full blur-3xl transition-transform duration-500 group-hover:scale-125" style={{ backgroundColor: `hsl(${tokens.hsl} / 0.15)` }} />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
          {state === "loading" ? <Skeleton className="mt-4 h-9 w-28" /> : state === "error" ? (
            <p className="mt-4 max-w-[15rem] text-sm leading-relaxed text-muted-foreground">Voltx is reconnecting to this live metric.</p>
          ) : state === "empty" ? (
            <div className="mt-4"><p className="text-lg font-semibold tracking-tight">{emptyLabel}</p><p className="mt-1 max-w-[15rem] text-xs leading-relaxed text-muted-foreground">{emptyDescription}</p></div>
          ) : (
            <p className="mt-4 text-4xl font-semibold leading-none tracking-tight tabular-nums"><CountUpValue value={value ?? 0} format={format} /></p>
          )}
        </div>
        <span className={cn("grid h-11 w-11 place-items-center rounded-2xl border shadow-[0_10px_24px_-14px_currentColor]", tokens.bg, tokens.border, tokens.fg)}><Icon className="h-[19px] w-[19px]" aria-hidden /></span>
      </div>

      {state === "ready" && change && (
        <div className={cn("relative mt-4 inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", positive ? "border-success/20 bg-success/[0.08] text-success" : "border-destructive/20 bg-destructive/[0.08] text-destructive")}>
          {positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {positive ? "+" : ""}{(change.percent * 100).toFixed(1)}%
          <span className="font-normal text-muted-foreground">{change.comparedTo}</span>
        </div>
      )}

      {state === "ready" && trend && trend.length > 2 ? <div className="relative mt-3"><SparklineChart points={trend} accent={accent} label={label} /></div> : (
        <div className="relative mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Sparkles className={cn("h-3.5 w-3.5", tokens.fg)} />{state === "empty" ? "Start building your workspace" : "History builds over time"}</span>
          <ArrowUpRight className={cn("h-4 w-4", tokens.fg)} aria-hidden />
        </div>
      )}
      <div className="relative mt-auto border-t border-white/[0.06] pt-3">
        <p className="line-clamp-1 text-[11px] leading-relaxed text-muted-foreground"><Sparkles className={cn("mr-1 inline h-3 w-3", tokens.fg)} />{insight}</p>
        <p className={cn("mt-1.5 text-xs font-medium", tokens.fg)}>Recommended: {recommendedAction}<ArrowUpRight className="ml-1 inline h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" /></p>
      </div>
      <Link href={href} className="absolute inset-0 rounded-[inherit]" aria-label={state === "empty" ? emptyLabel : `View ${label}`} />
    </article>
  );
}