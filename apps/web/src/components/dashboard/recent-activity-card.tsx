"use client";

import Link from "next/link";
import { ArrowRight, Calendar, CheckSquare, Mail, MessageCircle, Phone, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useActivities } from "@/hooks/use-sales";
import type { ActivityType } from "@/lib/api/sales";
import { formatRelativeTime } from "@/lib/format";

const icons: Record<ActivityType, LucideIcon> = { CALL: Phone, EMAIL: Mail, MEETING: Calendar, TASK: CheckSquare, NOTE: StickyNote };
const tones: Record<ActivityType, string> = { CALL: "border-info/20 bg-info/10 text-info", EMAIL: "border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]", MEETING: "border-primary/20 bg-primary/10 text-primary", TASK: "border-success/20 bg-success/10 text-success", NOTE: "border-warning/20 bg-warning/10 text-warning" };

export function RecentActivityCard() {
  const { data, isLoading, isError } = useActivities({ limit: 5 });
  return (
    <section className="surface-widget flex h-full min-h-[300px] flex-col rounded-[24px] p-5 sm:p-6" aria-labelledby="recent-activity-title">
      <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-info">Operational pulse</p><h2 id="recent-activity-title" className="mt-1 text-xl font-semibold tracking-tight">Recent activity</h2></div><Link href="/crm/activities" className="inline-flex items-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-info/25 hover:text-foreground">View all<ArrowRight className="h-3.5 w-3.5" /></Link></div>
      {isLoading && <div className="mt-5 space-y-3">{[1, 2, 3].map((index) => <Skeleton key={index} className="h-12 w-full" />)}</div>}
      {!isLoading && isError && <p className="mt-6 text-sm text-muted-foreground">Activity is temporarily unavailable.</p>}
      {!isLoading && !isError && data?.items.length === 0 && <div className="mt-6 flex flex-1 flex-col items-center justify-center text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-info/10 text-info"><MessageCircle className="h-5 w-5" /></span><p className="mt-3 text-sm font-medium">Start your operating history</p><p className="mt-1 max-w-xs text-xs leading-relaxed text-muted-foreground">Calls, emails, meetings, notes, and tasks will create a useful business timeline here.</p></div>}
      {!isLoading && !isError && data?.items.length ? <div className="relative mt-5 space-y-1 before:absolute before:bottom-3 before:left-[19px] before:top-3 before:w-px before:bg-white/[0.08]">{data.items.map((activity) => { const Icon = icons[activity.type]; return <Link href="/crm/activities" key={activity.id} className="group relative flex items-center gap-3 rounded-xl px-1 py-2.5 transition-colors hover:bg-white/[0.035]"><span className={`relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-2xl border shadow-[0_8px_18px_-14px_currentColor] ${tones[activity.type]}`}><Icon className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium group-hover:text-primary">{activity.subject}</span><span className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium capitalize ${tones[activity.type]}`}>{activity.type.toLowerCase()}</span>{formatRelativeTime(activity.occurredAt ?? activity.createdAt)}</span></span></Link>; })}</div> : null}
    </section>
  );
}