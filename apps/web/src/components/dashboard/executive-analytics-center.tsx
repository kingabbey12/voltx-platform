"use client";

import * as React from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  MessageSquareText,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useDashboardMetrics } from "@/hooks/use-dashboard";
import type { DashboardInsight, ExecutiveSnapshot, MetricPoint } from "@/lib/api/dashboard";
import { formatCount, formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

type Formatter = (value: number) => string;

interface AnalyticsDefinition {
  id: string;
  title: string;
  description: string;
  metricKey?: keyof ExecutiveSnapshot["snapshot"];
  trendKey?: string;
  formatter?: Formatter;
  icon: LucideIcon;
  href?: string;
  requiredData?: string;
  nextAction?: string;
}

const count: Formatter = (value) => formatCount(Math.round(value));

const analytics: AnalyticsDefinition[] = [
  { id: "revenue", title: "Revenue overview", description: "Closed-won value measures revenue already secured, while its history shows whether commercial output is building momentum.", metricKey: "wonValue", trendKey: "wonValue", formatter: formatCurrency, icon: CircleDollarSign, href: "/crm/opportunities" },
  { id: "sales", title: "Sales performance", description: "Qualified leads show the near-term supply of sales-ready demand entering your team’s process.", metricKey: "qualifiedLeads", trendKey: "qualifiedLeads", formatter: count, icon: TrendingUp, href: "/crm/leads" },
  { id: "customers", title: "Customer growth", description: "Company growth tracks the expansion of the account base represented in Voltx.", metricKey: "companies", trendKey: "companies", formatter: count, icon: Building2, href: "/crm/companies" },
  { id: "pipeline", title: "Pipeline health", description: "Open pipeline value represents potential revenue still in progress; it is not a revenue forecast.", metricKey: "pipelineValue", trendKey: "pipelineValue", formatter: formatCurrency, icon: BarChart3, href: "/crm/opportunities" },
  { id: "team", title: "Team activity", description: "Open activities measure outstanding CRM work that still deserves team attention.", metricKey: "openActivities", formatter: count, icon: Users, href: "/crm/activities", requiredData: "Historical activity snapshots", nextAction: "Keep CRM activities current so future movement can be explained." },
  { id: "workflows", title: "Workflow performance", description: "Execution volume, completion rate, and failures will explain how automations affect operations.", icon: Workflow, href: "/workflows", requiredData: "Workflow execution history in the dashboard metrics response", nextAction: "Run and monitor automations; this view will populate when analytics data is available." },
  { id: "communications", title: "Communication trends", description: "Message volume and backlog trends will show how quickly customer conversations are moving.", icon: MessageSquareText, href: "/inbox", requiredData: "Historical communication volume and backlog metrics", nextAction: "Continue managing conversations in Inbox while history accumulates." },
];

function direction(points: MetricPoint[]) {
  if (points.length < 2) return "not yet established";
  const first = points[0]?.value ?? 0;
  const last = points.at(-1)?.value ?? 0;
  return last === first ? "stable" : last > first ? "increasing" : "decreasing";
}

function evidenceInsight(definition: AnalyticsDefinition, snapshot: ExecutiveSnapshot, points: MetricPoint[]) {
  const serverInsight = snapshot.insights.find((item) => {
    const text = `${item.title} ${item.explanation}`.toLowerCase();
    return text.includes(definition.id) || text.includes(definition.title.split(" ")[0]!.toLowerCase());
  });
  if (serverInsight) return serverInsight;
  if (points.length < 2) return undefined;
  const movement = direction(points);
  return {
    type: "info",
    title: `${definition.title} is ${movement}`,
    explanation: `The available history shows this metric is ${movement}. Voltx needs supporting record-level evidence before attributing a cause.`,
    confidence: 1,
  } satisfies DashboardInsight;
}

function AccessibleTrend({ points, label, format }: { points: MetricPoint[]; label: string; format: Formatter }) {
  const [activeIndex, setActiveIndex] = React.useState(points.length - 1);
  const width = 640;
  const height = 188;
  const min = Math.min(...points.map((point) => point.value));
  const max = Math.max(...points.map((point) => point.value));
  const range = max - min || 1;
  const coordinates = points.map((point, index) => ({
    ...point,
    x: 18 + (index / Math.max(points.length - 1, 1)) * (width - 36),
    y: 18 + (height - 42) - ((point.value - min) / range) * (height - 54),
  }));
  const path = coordinates.map((point, index) => `${index ? "L" : "M"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  const active = coordinates[Math.max(0, activeIndex)] ?? coordinates.at(-1)!;

  return (
    <div className="relative mt-5 rounded-2xl border border-white/[0.07] bg-black/[0.08] p-3" role="group" aria-label={`${label} historical chart. Use left and right arrow keys to inspect values.`} tabIndex={0} onKeyDown={(event) => {
      if (event.key === "ArrowLeft") { event.preventDefault(); setActiveIndex((value) => Math.max(0, value - 1)); }
      if (event.key === "ArrowRight") { event.preventDefault(); setActiveIndex((value) => Math.min(points.length - 1, value + 1)); }
    }}>
      <div className="absolute left-4 top-3 z-10 rounded-lg border border-white/10 bg-background/90 px-2.5 py-1.5 text-[11px] shadow-xl backdrop-blur-xl" aria-live="polite">
        <span className="text-muted-foreground">{active.date}</span> <strong className="ml-1 tabular-nums">{format(active.value)}</strong>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-44 w-full overflow-visible" aria-hidden focusable="false">
        <defs><linearGradient id={`fill-${label.replace(/\s/g, "-")}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="hsl(var(--primary) / .28)" /><stop offset="100%" stopColor="hsl(var(--primary) / 0)" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((line) => <line key={line} x1="18" x2={width - 18} y1={height * line} y2={height * line} stroke="hsl(var(--border) / .45)" strokeDasharray="4 8" />)}
        <path d={`${path} L ${coordinates.at(-1)!.x} ${height - 14} L 18 ${height - 14} Z`} fill={`url(#fill-${label.replace(/\s/g, "-")})`} />
        <path d={path} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="motion-safe:[stroke-dasharray:1600] motion-safe:animate-[voltx-draw_1000ms_cubic-bezier(0.22,1,0.36,1)_both]" />
        {coordinates.map((point, index) => <circle key={point.date} cx={point.x} cy={point.y} r={index === activeIndex ? 5 : 3} fill={index === activeIndex ? "hsl(var(--primary))" : "hsl(var(--background))"} stroke="hsl(var(--primary))" strokeWidth="2" className="transition-[r]" />)}
      </svg>
      <p className="sr-only">{points.map((point) => `${point.date}: ${format(point.value)}`).join(", ")}</p>
    </div>
  );
}

function AnalyticsSkeleton() {
  return <div className="grid gap-4 lg:grid-cols-2" aria-label="Loading executive analytics">{Array.from({ length: 6 }, (_, index) => <div key={index} className="surface-card h-[390px] animate-pulse rounded-[26px] p-6 motion-reduce:animate-none"><div className="h-5 w-40 rounded bg-white/[0.08]" /><div className="mt-4 h-9 w-28 rounded bg-white/[0.08]" /><div className="mt-8 h-44 rounded-2xl bg-white/[0.05]" /><div className="mt-5 h-12 rounded-xl bg-white/[0.05]" /></div>)}</div>;
}

function EmptyExplanation({ definition }: { definition: AnalyticsDefinition }) {
  return <div className="mt-5 flex min-h-44 flex-col justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5"><p className="text-sm font-medium">Trend unavailable</p><p className="mt-2 text-xs leading-relaxed text-muted-foreground">Required: {definition.requiredData ?? `At least two daily ${definition.title.toLowerCase()} snapshots`}.</p><p className="mt-3 text-xs leading-relaxed text-muted-foreground">{definition.nextAction ?? "Keep using Voltx; this comparison will appear as daily history accumulates."}</p></div>;
}

function AnalyticsCard({ definition, snapshot }: { definition: AnalyticsDefinition; snapshot: ExecutiveSnapshot }) {
  const Icon = definition.icon;
  const points = definition.trendKey ? snapshot.trends[definition.trendKey] ?? [] : [];
  const value = definition.metricKey ? snapshot.snapshot[definition.metricKey] : undefined;
  const format = definition.formatter ?? count;
  const insight = evidenceInsight(definition, snapshot, points);
  const change = definition.metricKey ? snapshot.changes[definition.metricKey] : undefined;

  return <Dialog><article id={definition.id} className="surface-card scroll-mt-24 rounded-[26px] p-5 sm:p-6" aria-labelledby={`${definition.id}-title`}>
    <div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2"><Icon className="h-4 w-4 text-primary" aria-hidden /><h3 id={`${definition.id}-title`} className="text-base font-semibold tracking-tight">{definition.title}</h3></div><p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{definition.description}</p></div>{definition.href && <Link href={definition.href} className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`View supporting records for ${definition.title}`}><ArrowRight className="h-4 w-4" /></Link>}</div>
    {value !== undefined && <div className="mt-5 flex flex-wrap items-end gap-3"><strong className="text-3xl font-semibold tracking-tight tabular-nums">{format(value)}</strong>{change?.percent !== null && change?.percent !== undefined && <span className={cn("mb-1 rounded-full px-2 py-1 text-[11px] font-medium", change.percent >= 0 ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>{change.percent >= 0 ? "+" : ""}{(change.percent * 100).toFixed(1)}% {change.comparedTo}</span>}</div>}
    {points.length >= 2 ? <AccessibleTrend points={points} label={definition.title} format={format} /> : <EmptyExplanation definition={definition} />}
    <div className="mt-4 rounded-2xl border border-primary/10 bg-primary/[0.04] p-4"><div className="flex items-center gap-2 text-xs font-semibold"><Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />AI explanation</div>{insight ? <><p className="mt-2 text-sm font-medium">{insight.title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.explanation}</p></> : <p className="mt-2 text-xs leading-relaxed text-muted-foreground">More historical information is required before Voltx can explain movement in this metric.</p>}</div>
    {value !== undefined && <DialogTrigger asChild><button type="button" className="mt-4 rounded-xl border border-white/10 px-3 py-2 text-xs font-medium transition-colors hover:border-primary/40 hover:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={`View metric detail for ${definition.title}`}>View detail</button></DialogTrigger>}
  </article><DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{definition.title}</DialogTitle><DialogDescription>{definition.description}</DialogDescription></DialogHeader>{value !== undefined && <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs font-medium text-muted-foreground">Current value</p><p className="mt-2 text-3xl font-semibold tabular-nums">{format(value)}</p>{change?.percent !== null && change?.percent !== undefined && <p className="mt-2 text-sm text-muted-foreground">{change.percent >= 0 ? "+" : ""}{(change.percent * 100).toFixed(1)}% {change.comparedTo}</p>}</div>}{points.length >= 2 ? <AccessibleTrend points={points} label={`${definition.title} detail`} format={format} /> : <EmptyExplanation definition={definition} />}{insight && <section className="mt-5 border-t border-border/70 pt-5"><h4 className="text-sm font-semibold">Available explanation</h4><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{insight.explanation}</p></section>}</DialogContent></Dialog>;
}

export function ExecutiveAnalyticsCenter() {
  const { data, isLoading, isError, refetch } = useDashboardMetrics();
  return <section className="pt-8 sm:pt-12" aria-labelledby="analytics-center-title">
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">Executive analytics</p><h2 id="analytics-center-title" className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Understand the business, not just the numbers.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Evidence-backed trends, honest availability states, and explanations drawn only from your workspace data.</p></div><span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs text-muted-foreground"><Activity className="h-3.5 w-3.5 text-success" aria-hidden />{data ? `${data.meta.historyDays} days of history` : "Checking history"}</span></div>
    {isLoading ? <AnalyticsSkeleton /> : isError || !data ? <div role="alert" className="surface-card rounded-[26px] p-8 text-center"><BarChart3 className="mx-auto h-6 w-6 text-muted-foreground" /><h3 className="mt-4 font-semibold">Analytics could not be refreshed</h3><p className="mt-2 text-sm text-muted-foreground">Your existing records are unchanged. Reconnect to load the latest executive view.</p><button type="button" onClick={() => refetch()} className="mt-5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">Try again</button></div> : <>
      <div className="grid gap-4 lg:grid-cols-2">{analytics.map((definition) => <AnalyticsCard key={definition.id} definition={definition} snapshot={data} />)}</div>
      <article className="surface-card mt-4 rounded-[26px] p-5 sm:p-7" aria-labelledby="executive-report-title"><div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" /><h3 id="executive-report-title" className="font-semibold">Executive report</h3></div><p className="mt-2 text-sm text-muted-foreground">A concise view of what happened, what needs attention, and what the available evidence supports.</p><div className="mt-6 grid gap-3 md:grid-cols-3"><ReportSummary title="Revenue & CRM" text={`${formatCurrency(data.snapshot.wonValue)} won, ${formatCurrency(data.snapshot.pipelineValue)} in open pipeline, and ${formatCount(data.snapshot.qualifiedLeads)} qualified leads.`} /><ReportSummary title="Operations" text={`${formatCount(data.snapshot.openActivities)} open activities. Workflow and communication trend summaries will appear when their analytics are exposed.`} /><ReportSummary title="AI summary" text={data.insights[0]?.explanation ?? "More historical information is required before Voltx can produce an evidence-backed executive explanation."} /></div><p className="mt-5 text-xs text-muted-foreground">Exports are unavailable because the current dashboard does not expose an implemented export action.</p></article>
    </>}
  </section>;
}

function ReportSummary({ title, text }: { title: string; text: string }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4"><h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</h4><p className="mt-3 text-sm leading-relaxed">{text}</p></div>;
}
