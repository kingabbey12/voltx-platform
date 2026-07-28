"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUpValue } from "@/components/dashboard/count-up-value";
import { cn } from "@/lib/utils";

/**
 * A KPI that helps someone decide something.
 *
 * The previous card rendered one number in a large box. On a new workspace that
 * meant "$0" and three zeros — technically accurate and completely useless. A
 * metric is only worth showing if it answers what happened, whether it is
 * improving, and what to do next.
 *
 * DATA AVAILABILITY (verified against the backend, not assumed):
 * there is no historical series anywhere in the API today. Every dashboard
 * number comes from a list endpoint's pagination `total`. So `series` and
 * `delta` are optional and simply do not render when absent — no invented
 * sparkline, no fabricated percentage. The props exist so that when a
 * `/dashboard/metrics` endpoint returns history, it drops in without
 * redesigning this component or its call sites.
 */

export type KpiState = "loading" | "ready" | "empty" | "error";

export interface KpiDelta {
  /** Signed fraction, e.g. 0.125 for +12.5%. */
  change: number;
  /** What it is measured against — "vs last week". Never render a change
   *  without saying compared to what; the number is meaningless alone. */
  comparison: string;
}

export interface KpiEmptyGuidance {
  /** What this metric represents and why it matters — one short sentence. */
  explanation: string;
  action: { label: string; href: string };
}

export interface KpiCardProps {
  label: string;
  icon: LucideIcon;
  state: KpiState;
  /** Required for `ready`; ignored otherwise. */
  value?: number;
  format?: (value: number) => string;
  /** Historical points, oldest first. Renders a sparkline when supplied.
   *  Nothing in the API produces this yet. */
  series?: number[];
  delta?: KpiDelta;
  /** Shown instead of a zero when the workspace genuinely has no data. */
  guidance?: KpiEmptyGuidance;
  /** Quick action for the populated state. */
  action?: { label: string; href: string };
  /** Higher is better for most metrics; set false where a rise is bad
   *  (churn, overdue tasks) so the colour does not lie. */
  higherIsBetter?: boolean;
  className?: string;
}

/**
 * Inline sparkline. Deliberately unlabelled and low-contrast — it conveys
 * shape, not values; the precise number is already the headline.
 */
function Sparkline({ points, positive }: { points: number[]; positive: boolean }) {
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 88;
  const height = 28;

  const d = points
    .map((point, i) => {
      const x = (i / (points.length - 1)) * width;
      const y = height - ((point - min) / range) * height;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-7 w-[88px] shrink-0 overflow-visible"
      aria-hidden
      focusable="false"
    >
      <path
        d={d}
        fill="none"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={positive ? "stroke-success" : "stroke-destructive"}
      />
    </svg>
  );
}

function DeltaBadge({ delta, higherIsBetter }: { delta: KpiDelta; higherIsBetter: boolean }) {
  const rising = delta.change > 0;
  const flat = delta.change === 0;
  // Direction and desirability are different things: a rise in churn is not good
  // news, so colour follows whether the movement helps, not whether it is up.
  const good = flat ? null : rising === higherIsBetter;
  const Icon = rising ? TrendingUp : TrendingDown;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium tabular-nums",
        good === null && "text-muted-foreground",
        good === true && "text-success",
        good === false && "text-destructive",
      )}
    >
      {!flat && <Icon className="h-3 w-3" aria-hidden />}
      {rising ? "+" : ""}
      {(delta.change * 100).toFixed(1)}%
      <span className="font-normal text-muted-foreground/70">{delta.comparison}</span>
    </span>
  );
}

export function KpiCard({
  label,
  icon: Icon,
  state,
  value,
  format = (n) => String(n),
  series,
  delta,
  guidance,
  action,
  higherIsBetter = true,
  className,
}: KpiCardProps) {
  const header = (
    <div className="flex items-start justify-between gap-3">
      <p className="text-sm text-muted-foreground">{label}</p>
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" aria-hidden />
      </span>
    </div>
  );

  if (state === "loading") {
    return (
      <Card className={cn("p-4", className)} aria-busy>
        {header}
        <Skeleton className="mt-3 h-7 w-24" />
        <Skeleton className="mt-2 h-3 w-32" />
      </Card>
    );
  }

  if (state === "error") {
    return (
      <Card className={cn("p-4", className)}>
        {header}
        <p className="mt-3 text-sm text-muted-foreground">Couldn&apos;t load this metric.</p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          It will retry automatically. Other metrics are unaffected.
        </p>
      </Card>
    );
  }

  // The first-run case. Showing "$0" here tells a new user their pipeline is
  // worth nothing; showing them how to create one tells them what to do. This
  // is the state most new workspaces sit in, so it gets the most care.
  if (state === "empty" && guidance) {
    return (
      // Stretched link rather than wrapping the Card in an <a>: Card renders a
      // plain div with no Slot support, and nesting the whole card inside an
      // anchor would swallow any future interactive child.
      <Card variant="interactive" className={cn("group relative p-4", className)}>
        {header}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {guidance.explanation}
        </p>
        <Link
          href={guidance.action.href}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary after:absolute after:inset-0 after:content-['']"
        >
          {guidance.action.label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </Card>
    );
  }

  const positive = delta ? delta.change > 0 === higherIsBetter : true;

  return (
    <Card className={cn("p-4", className)}>
      {header}

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-2xl font-semibold tabular-nums tracking-tight">
          <CountUpValue value={value ?? 0} format={format} />
        </p>
        {series && series.length > 1 && <Sparkline points={series} positive={positive} />}
      </div>

      {delta && (
        <div className="mt-2">
          <DeltaBadge delta={delta} higherIsBetter={higherIsBetter} />
        </div>
      )}

      {/* No trend data exists in the API yet. Rather than leave dead space or
          invent a number, say plainly that comparison is not available — an
          honest gap reads better than a fabricated one. */}
      {!delta && !series && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground/50">
          <Sparkles className="h-3 w-3" aria-hidden />
          Trends available once history is collected
        </p>
      )}

      {action && (
        <Link
          href={action.href}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          {action.label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      )}
    </Card>
  );
}
