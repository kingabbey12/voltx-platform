"use client";

import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Clock3, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useExecutiveBrief } from "@/hooks/use-dashboard";
import type { DashboardRecommendation, ExecutiveBrief } from "@/lib/api/dashboard";

export function TodaysBriefCard() {
  const { data: brief, isLoading, isError } = useExecutiveBrief();
  const [open, setOpen] = useState(false);

  return (
    <section id="todays-brief" className="surface-widget flex h-full min-h-[300px] flex-col rounded-[24px] p-5 sm:p-6" aria-labelledby="todays-brief-title">
      <div className="flex items-start justify-between gap-4"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[hsl(268_83%_76%)]">Executive signal</p><h2 id="todays-brief-title" className="mt-1 text-xl font-semibold tracking-tight">Today&apos;s brief</h2></div><span className="grid h-10 w-10 place-items-center rounded-2xl border border-[hsl(268_83%_68%/0.24)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)] shadow-[0_10px_24px_-16px_hsl(268_83%_68%/0.8)]"><Sparkles className="h-4 w-4" /></span></div>
      {isLoading && <div className="mt-6 space-y-3"><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-16 w-full" /></div>}
      {!isLoading && isError && <div className="mt-6 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-sm font-medium">Your brief is being prepared</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Voltx will surface verified changes, risks, and opportunities as business activity becomes available.</p></div>}
      {!isLoading && !isError && (!brief || brief.changes.length === 0) && <div className="mt-6 flex flex-1 flex-col justify-center rounded-2xl border border-[hsl(268_83%_68%/0.18)] bg-[radial-gradient(circle_at_100%_0%,hsl(268_83%_68%/0.13),transparent_54%),hsl(268_83%_68%/0.05)] p-4"><p className="text-sm font-semibold">Your daily brief is being prepared</p><p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">As Voltx learns from your activity, it will surface important changes, risks, and opportunities automatically.</p><span className="mt-4 inline-flex items-center gap-1.5 text-xs text-[hsl(268_83%_76%)]"><Clock3 className="h-3.5 w-3.5" />Live data, no speculative insights</span></div>}
      {!isLoading && !isError && brief && brief.changes.length > 0 && <div className="mt-5 flex flex-1 flex-col"><p className="text-sm leading-relaxed text-muted-foreground">{brief.summary}</p><div className="mt-4 space-y-3">{brief.changes.slice(0, 2).map((change) => <Link key={change.id} href="#executive-priorities" className="group flex items-start gap-3 rounded-xl border border-white/[0.07] bg-white/[0.018] p-3 transition-colors hover:border-[hsl(268_83%_68%/0.35)]"><TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span className="min-w-0 flex-1"><span className="block text-sm font-medium">{change.title}</span><span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{change.summary}</span></span><ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" /></Link>)}</div>{brief.wins.length > 0 && <p className="mt-auto pt-4 text-xs text-success"><CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />{brief.wins.length} verified win{brief.wins.length === 1 ? "" : "s"} in the last 24 hours</p>}<div className="mt-auto pt-4"><Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>Open morning briefing<ArrowUpRight className="h-3.5 w-3.5" /></Button><p className="mt-2 text-[11px] text-muted-foreground">Data freshness: {brief.dataFreshness}</p></div></div>}
      {brief && <MorningBrief open={open} onOpenChange={setOpen} brief={brief} />}
    </section>
  );
}

function MorningBrief({ open, onOpenChange, brief }: { open: boolean; onOpenChange: (open: boolean) => void; brief: ExecutiveBrief }) {
  const signalFor = (category: DashboardRecommendation["category"]) => brief.changes.find((recommendation) => recommendation.category === category) ?? brief.risks.find((recommendation) => recommendation.category === category) ?? brief.recommendedNextActions.find((recommendation) => recommendation.category === category);
  const sections = [
    { title: "Today's Business", signal: undefined, summary: brief.summary, href: "#executive-priorities" },
    { title: "Sales Summary", signal: signalFor("SALES") },
    { title: "Pipeline Summary", unavailable: "The existing executive brief does not expose a dedicated pipeline narrative. Open Analytics for the verified pipeline snapshot and history." },
    { title: "Customer Summary", signal: signalFor("CUSTOMER"), unavailable: "The executive brief has no verified customer recommendation at this time. Voltx needs a supported customer signal before describing account movement or risk." },
    { title: "Workflow Summary", signal: signalFor("WORKFLOW"), unavailable: "Workflow execution performance is not exposed through the executive brief. Open Workflows to review its available operational records." },
    { title: "Communications Summary", unavailable: "Communication volume and backlog are not exposed through the executive brief, so Voltx cannot produce a verified summary here." },
    { title: "Operational Summary", signal: signalFor("OPERATIONS"), unavailable: "The executive brief has no verified operational recommendation at this time. Additional operational data is required before Voltx can describe a change." },
    { title: "AI Summary", signal: undefined, summary: brief.summary, href: "#decision-center-title" },
  ];
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Executive morning briefing</DialogTitle><DialogDescription>What changed, why it matters, and the next supported action. Generated from the current executive brief only.</DialogDescription></DialogHeader><div className="grid gap-3 md:grid-cols-2">{sections.map((section) => <BriefSection key={section.title} {...section} />)}</div><p className="text-xs text-muted-foreground">Data freshness: {brief.dataFreshness}</p></DialogContent></Dialog>;
}

function BriefSection({ title, signal, summary, href, unavailable }: { title: string; signal?: DashboardRecommendation; summary?: string; href?: string; unavailable?: string }) {
  const evidence = signal?.evidence[0];
  const recordHref = evidence?.href ?? href;
  return <section className="rounded-xl border border-border/70 bg-muted/[0.14] p-4" aria-label={title}><h3 className="text-sm font-semibold">{title}</h3>{signal ? <><p className="mt-3 text-xs font-medium text-muted-foreground">What happened</p><p className="mt-1 text-sm">{signal.summary}</p><p className="mt-3 text-xs font-medium text-muted-foreground">Why it matters</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{signal.businessImpact}</p><p className="mt-3 text-xs font-medium text-muted-foreground">Deserves attention</p><p className="mt-1 text-sm text-primary">{signal.recommendedNextStep}</p></> : summary ? <><p className="mt-3 text-xs font-medium text-muted-foreground">What happened</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{summary}</p><p className="mt-3 text-xs font-medium text-muted-foreground">Why it matters</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">This summary contains the latest verified executive signals. Open the supporting decisions to review their reasoning and actions.</p></> : <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{unavailable}</p>}{recordHref && <Link href={recordHref} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">Open supporting records<ArrowUpRight className="h-3.5 w-3.5" /></Link>}</section>;
}