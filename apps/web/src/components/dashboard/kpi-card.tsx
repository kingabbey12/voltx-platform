"use client";

import * as React from "react";

import Link from "next/link";
import { ArrowRight, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUpValue } from "@/components/dashboard/count-up-value";
import { ACCENTS, type Accent } from "@/lib/design-language";
import { cn } from "@/lib/utils";

/**
 * A KPI that helps someone decide something.
 *
 * The previous card rendered one number in a large box. On a new workspace that
 * meant "$0" and three zeros — technically accurate and completely useless. A
 * metric is only worth showing if it answers what happened, whether it is
 * improving, and what to do next.
 *
 * DATA AVAILABILITY: `series` and `delta` now come from GET /dashboard/metrics,
 * backed by daily snapshots. They remain optional because a workspace has no
 * history until the nightly aggregation has run — in that case the sparkline
 * and the percentage are omitted rather than invented, and the card says so.
 */

export type KpiState = "loading" | "ready" | "empty" | "error";

/** Accents come from the shared colour language — see lib/design-language.ts. */
export type KpiAccent = Accent;

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
  /** Visual identity for this metric. Defaults to gold. */
  accent?: KpiAccent;
  className?: string;
}

/**
 * Inline sparkline. Deliberately unlabelled and low-contrast — it conveys
 * shape, not values; the precise number is already the headline.
 */
function Sparkline({
  points,
  accent,
  muted,
}: {
  points: number[];
  accent: KpiAccent;
  /** Flat data draws grey — a coloured line implies movement that is not there. */
  muted: boolean;
}) {
  const id = React.useId();
  if (points.length < 2) return null;

  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 240;
  const height = 40;

  const coords = points.map((point, i) => ({
    x: (i / (points.length - 1)) * width,
    // Inset by 2px top and bottom so a peak is never clipped by the viewBox.
    y: 2 + (height - 4) - ((point - min) / range) * (height - 4),
  }));

  // Catmull-Rom converted to cubic bezier. Straight segments between points
  // read as a jagged data plot; a smoothed curve reads as a considered chart,
  // which is the whole difference between showing data and showing quality.
  const line = coords.reduce((path, point, i) => {
    if (i === 0) return `M${point.x.toFixed(1)},${point.y.toFixed(1)}`;
    // noUncheckedIndexedAccess is on, so every lookup needs a fallback. i >= 1
    // here, so prev always exists; the ?? keeps the compiler satisfied without
    // an assertion that could hide a real bug later.
    const prev = coords[i - 1] ?? point;
    const prev2 = coords[i - 2] ?? prev;
    const next = coords[i + 1] ?? point;
    const c1x = prev.x + (point.x - prev2.x) / 6;
    const c1y = prev.y + (point.y - prev2.y) / 6;
    const c2x = point.x - (next.x - prev.x) / 6;
    const c2y = point.y - (next.y - prev.y) / 6;
    return `${path} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${point.x.toFixed(1)},${point.y.toFixed(1)}`;
  }, "");

  const hsl = muted ? "0 0% 60%" : ACCENTS[accent].hsl;
  const area = `${line} L${width},${height} L0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-10 w-full"
      aria-hidden
      focusable="false"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={`hsl(${hsl} / ${muted ? 0.25 : 0.45})`} />
          <stop offset="100%" stopColor={`hsl(${hsl} / ${muted ? 0.5 : 1})`} />
        </linearGradient>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`hsl(${hsl} / ${muted ? 0.1 : 0.22})`} />
          <stop offset="100%" stopColor={`hsl(${hsl} / 0)`} />
        </linearGradient>
      </defs>

      {/* Fill first so the stroke sits on top of its own gradient. */}
      <path d={area} fill={`url(#${id}-fill)`} />
      <path
        d={line}
        fill="none"
        stroke={`url(#${id}-stroke)`}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke-dasharray:200] [stroke-dashoffset:0] motion-safe:animate-[voltx-draw_900ms_cubic-bezier(0.22,1,0.36,1)_both]"
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
  accent = "gold",
  className,
}: KpiCardProps) {
  const header = (
    <div className="flex items-start justify-between gap-3">
      {/* Quieter than the metric by design: the number is the headline, the
          label is a caption. Uppercase tracking separates them without adding
          weight. */}
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
        {label}
      </p>
      <span
        className={cn(
          "grid h-8 w-8 shrink-0 place-items-center rounded-lg",
          ACCENTS[accent].bg,
          ACCENTS[accent].fg,
        )}
      >
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

  // Flat is not decline. Colouring a zero change red tells someone their
  // pipeline is falling when it has not moved at all — and a flat line is
  // exactly what a workspace with backfilled or unchanging data produces.
  const tone: "positive" | "negative" | "neutral" = !delta
    ? "neutral"
    : delta.change === 0
      ? "neutral"
      : delta.change > 0 === higherIsBetter
        ? "positive"
        : "negative";

  return (
    <Card className={cn("p-4", className)}>
      {header}

      <p className="mt-4 text-[28px] font-semibold leading-none tabular-nums tracking-tight">
        <CountUpValue value={value ?? 0} format={format} />
      </p>

      {delta && (
        <div className="mt-2">
          <DeltaBadge delta={delta} higherIsBetter={higherIsBetter} />
        </div>
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

      {/* Full-bleed band rather than an inline chip. A sparkline squeezed
          beside the number reads as an afterthought; given the card's width it
          becomes the card's texture, and the shape is legible at a glance
          instead of needing to be looked for. Negative margins let it meet the
          card edges under the padding. */}
      {series && series.length > 1 && (
        <div className="-mx-4 -mb-4 mt-4 overflow-hidden rounded-b-[calc(var(--radius)-1px)]">
          <Sparkline points={series} accent={accent} muted={tone === "neutral"} />
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
    </Card>
  );
}
