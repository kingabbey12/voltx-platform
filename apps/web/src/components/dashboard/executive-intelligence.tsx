"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Circle,
  Info,
  Lightbulb,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import type { DashboardInsight, DashboardPriority } from "@/lib/api/dashboard";
import { cn } from "@/lib/utils";

/**
 * The three intelligence sections: Today's Brief, Business Health, Priorities.
 *
 * All three read the same `useDashboardMetrics` query the KPI row uses, so they
 * share one cache entry and one loading state rather than resolving at
 * different moments and making the page shuffle as it settles.
 *
 * Every one of them is empty today, because the backend providers are bound to
 * no-op implementations. That is the interesting design problem here: an empty
 * intelligence panel must read as "not yet", never as "broken". The block these
 * replace said "AI Command Center is unavailable" — an error message in the
 * most valuable strip of the page, which made a working product look failed.
 */

function SectionHeading({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Sparkles;
  title: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" aria-hidden />
      <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
      {hint && <span className="text-xs text-muted-foreground/60">{hint}</span>}
    </div>
  );
}

const INSIGHT_ICON = {
  warning: AlertTriangle,
  opportunity: Lightbulb,
  info: Info,
} as const;

const INSIGHT_TONE = {
  warning: "text-warning",
  opportunity: "text-success",
  info: "text-info",
} as const;

/** Today's Brief — what should I know? */
export function TodaysBrief() {
  const { data, isLoading, isError } = useDashboardMetrics();
  const insights: DashboardInsight[] = data?.insights ?? [];
  const historyDays = data?.meta.historyDays ?? 0;

  return (
    <Card className="flex h-full flex-col p-5">
      <SectionHeading icon={Sparkles} title="Today's brief" />

      {isLoading && (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}

      {/* A failed brief is not a failed dashboard. It states what is missing
          and leaves the rest of the page alone. */}
      {!isLoading && isError && (
        <p className="mt-4 text-sm text-muted-foreground">
          Couldn&apos;t load your brief just now. Your metrics above are unaffected.
        </p>
      )}

      {!isLoading && !isError && insights.length === 0 && (
        <div className="mt-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Your brief will highlight risks and opportunities — stalling deals, leads going
            cold, follow-ups worth making — as soon as there is enough history to compare
            against.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/60">
            {historyDays > 0
              ? `${historyDays} day${historyDays === 1 ? "" : "s"} of history collected so far.`
              : "History starts building from your first full day of activity."}
          </p>
        </div>
      )}

      {!isLoading && !isError && insights.length > 0 && (
        <ul className="mt-4 flex flex-col gap-3">
          {insights.map((insight, i) => {
            const Icon = INSIGHT_ICON[insight.type];
            return (
              <li key={`${insight.title}-${i}`} className="flex gap-3">
                <Icon
                  className={cn("mt-0.5 h-4 w-4 shrink-0", INSIGHT_TONE[insight.type])}
                  aria-hidden
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{insight.explanation}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Business Health — how are we doing overall? */
export function BusinessHealth() {
  const { data, isLoading } = useDashboardMetrics();
  const health = data?.health;
  const historyDays = data?.meta.historyDays ?? 0;

  return (
    <Card className="flex h-full flex-col p-5">
      <SectionHeading icon={CheckCircle2} title="Business health" />

      {isLoading ? (
        <Skeleton className="mt-4 h-16 w-full" />
      ) : health?.score === null || health === undefined ? (
        <div className="mt-4">
          <p className="text-sm font-medium">Building your baseline</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            A health score compares today against your own normal. Until there is enough
            history to establish that, a number here would be a guess.
          </p>
          {historyDays > 0 && (
            <div className="mt-3">
              {/* Progress toward a meaningful baseline. Concrete beats
                  "calculating…", which says nothing about how long. */}
              <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className="h-full rounded-full bg-primary/60 transition-[width] duration-500"
                  style={{ width: `${Math.min((historyDays / 30) * 100, 100)}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground/60">
                {historyDays} of 30 days collected
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-4 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums tracking-tight">
            {health.score}
          </span>
          <span className="text-sm capitalize text-muted-foreground">{health.status}</span>
        </div>
      )}
    </Card>
  );
}

const URGENCY_TONE = {
  high: "text-destructive",
  medium: "text-warning",
  low: "text-muted-foreground",
} as const;

/** Priorities — what should I do next? */
export function Priorities() {
  const { data, isLoading } = useDashboardMetrics();
  const priorities: DashboardPriority[] = data?.priorities ?? [];

  return (
    <Card className="flex h-full flex-col p-5">
      <SectionHeading icon={Circle} title="Priorities" />

      {isLoading ? (
        <div className="mt-4 flex flex-col gap-2">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      ) : priorities.length === 0 ? (
        // An empty priority list is a legitimate business state — nothing needs
        // you right now — not a gap to apologise for.
        <div className="mt-4">
          <p className="text-sm font-medium">No high-priority actions today</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Deals at risk, overdue follow-ups and stalling opportunities will surface here
            as your pipeline builds.
          </p>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {priorities.map((priority) => (
            <li key={priority.id} className="flex items-start gap-3">
              <Circle
                className={cn("mt-1 h-2 w-2 shrink-0 fill-current", URGENCY_TONE[priority.urgency])}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                {priority.href ? (
                  <Link
                    href={priority.href}
                    className="group inline-flex items-center gap-1 text-sm font-medium hover:text-primary"
                  >
                    {priority.title}
                    <ArrowRight className="h-3 w-3 opacity-0 transition-opacity group-hover:opacity-100" />
                  </Link>
                ) : (
                  <p className="text-sm font-medium">{priority.title}</p>
                )}
                <p className="mt-0.5 text-sm text-muted-foreground">{priority.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
