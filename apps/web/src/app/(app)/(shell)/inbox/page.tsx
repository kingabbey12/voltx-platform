"use client";

import { useDeferredValue, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArrowRight, ChevronRight, CircleAlert, Inbox as InboxIcon, Mail, MessageCircleMore, MessagesSquare, Phone, Pin, Search, Sparkles, UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { QueryErrorState } from "@/components/query-error-state";
import { useConversations } from "@/hooks/use-communications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommsChannel } from "@/lib/api/communications";

type FilterKey = "all" | "unread" | "pinned" | "archived";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "pinned", label: "Pinned" },
  { key: "archived", label: "Archived" },
];

const PRIORITY_VARIANT: Record<string, "secondary" | "warning" | "destructive" | "outline"> = {
  LOW: "outline",
  NORMAL: "secondary",
  HIGH: "warning",
  URGENT: "destructive",
};

const CHANNEL_STYLE: Record<CommsChannel, { icon: typeof Mail; label: string; tone: string }> = {
  GMAIL: { icon: Mail, label: "Email", tone: "border-destructive/20 bg-destructive/10 text-destructive" },
  OUTLOOK: { icon: Mail, label: "Email", tone: "border-info/20 bg-info/10 text-info" },
  WHATSAPP: { icon: MessageCircleMore, label: "WhatsApp", tone: "border-success/20 bg-success/10 text-success" },
  TWILIO_VOICE: { icon: Phone, label: "Call", tone: "border-warning/20 bg-warning/10 text-warning" },
  TWILIO_SMS: { icon: MessagesSquare, label: "SMS", tone: "border-info/20 bg-info/10 text-info" },
  SLACK: { icon: MessagesSquare, label: "Slack", tone: "border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]" },
  TEAMS: { icon: UsersRound, label: "Teams", tone: "border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]" },
};

export default function InboxPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const { data, isLoading, isError, refetch } = useConversations({
    search: deferredSearch || undefined,
    unread: filter === "unread" ? true : undefined,
    status: filter === "pinned" ? "PINNED" : filter === "archived" ? "ARCHIVED" : undefined,
  });
  const conversations = data?.items ?? [];
  const unreadCount = conversations.filter((conversation) => conversation.unread).length;
  const urgentCount = conversations.filter((conversation) => conversation.priority === "URGENT").length;
  const highPriorityCount = conversations.filter((conversation) => conversation.priority === "HIGH" || conversation.priority === "URGENT").length;
  const pinnedCount = conversations.filter((conversation) => conversation.status === "PINNED").length;

  return (
    <div className="relative mx-auto max-w-[1400px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(ellipse_at_20%_0%,hsl(217_91%_60%/0.08),transparent_45%),radial-gradient(ellipse_at_78%_5%,hsl(268_83%_68%/0.10),transparent_40%)]" />
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[hsl(268_83%_68%/0.28)] bg-[hsl(268_83%_68%/0.10)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(268_83%_76%)]"><Sparkles className="h-3.5 w-3.5" />Communication intelligence</span>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Executive Inbox</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Every customer conversation, channel, and decision signal in one focused workspace.</p>
        </div>
        <div className="relative w-full lg:w-[360px]"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search live conversations" className="h-11 w-full rounded-xl border border-white/[0.09] bg-black/25 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/50 focus:ring-2 focus:ring-primary/15" /></div>
      </div>

      <section className="surface-raised relative mt-7 overflow-hidden rounded-[24px] p-5 sm:p-6" aria-labelledby="communication-brief-title">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[hsl(268_83%_68%/0.14)] blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"><div><p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-[hsl(268_83%_76%)]">AI Daily Communication Brief</p><h2 id="communication-brief-title" className="mt-2 text-xl font-semibold tracking-tight">Live inbox signals, ready for your attention.</h2><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">Review unread and high-priority conversations, then open a thread to use Voltx&apos;s real conversation summary and reply drafting tools.</p></div><Button variant="outline" className="border-[hsl(268_83%_68%/0.26)] bg-black/20" onClick={() => setFilter("unread")}>Review unread<ArrowRight className="h-4 w-4" /></Button></div>
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><SignalCard label="Unread now" value={unreadCount} tone="text-info" icon={InboxIcon} /><SignalCard label="Urgent" value={urgentCount} tone="text-destructive" icon={CircleAlert} /><SignalCard label="Priority queue" value={highPriorityCount} tone="text-warning" icon={Sparkles} /><SignalCard label="Pinned context" value={pinnedCount} tone="text-primary" icon={Pin} /></div>
      </section>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-white/[0.07] bg-black/20 p-1.5 backdrop-blur-xl">
        <div className="flex min-w-max gap-1">{FILTERS.map((f) => (<button key={f.key} onClick={() => setFilter(f.key)} className={cn("relative rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted-foreground transition-[background-color,color,box-shadow] duration-200 hover:bg-white/[0.045] hover:text-foreground", filter === f.key && "bg-[linear-gradient(110deg,hsl(var(--primary)/0.14),hsl(268_83%_68%/0.07))] text-foreground shadow-[0_10px_20px_-18px_hsl(var(--primary)/0.9)]")}>{f.label}{filter === f.key && <span className="absolute inset-x-4 bottom-1 h-px rounded-full bg-primary/80" />}</button>))}</div>
      </div>

      <section className="surface-widget mt-4 overflow-hidden rounded-[24px]" aria-label="Unified inbox conversations">
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4 sm:px-6"><div><p className="text-sm font-semibold tracking-tight">Unified conversation stream</p><p className="mt-0.5 text-xs text-muted-foreground">Chronological across every connected channel</p></div><span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2.5 py-1 text-[11px] text-muted-foreground">{data?.total ?? 0} total</span></div>
        {isLoading && (
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[92px] rounded-2xl" />
            ))}
          </div>
        )}

        {!isLoading && isError && (
          <QueryErrorState title="Conversations could not be loaded" onRetry={() => void refetch()} />
        )}

        {!isLoading && !isError && data?.items.length === 0 && (
          <EmptyState
            icon={InboxIcon}
            title="Build your communication command center"
            description="Connect a channel to bring customer conversations into one chronological workspace."
            action={
              <div className="flex flex-wrap justify-center gap-2"><Button size="sm" onClick={() => router.push("/settings/communications")}>Connect a channel</Button><Button size="sm" variant="outline" onClick={() => setFilter("all")}>View all signals</Button></div>
            }
          />
        )}

        {!isError && <div className="divide-y divide-white/[0.06] p-2 sm:p-3">
          {conversations.map((conversation) => {
            const channel = CHANNEL_STYLE[conversation.channel];
            const ChannelIcon = channel.icon;
            return (
            <button
              key={conversation.id}
              onClick={() => router.push(`/inbox/${conversation.id}`)}
              className={cn(
                "group flex w-full items-center gap-3 rounded-2xl px-3 py-3.5 text-left transition-[background-color,transform] duration-200 hover:bg-white/[0.045] sm:px-4",
                conversation.unread && "bg-primary/[0.045]",
              )}
            >
              <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl border shadow-[0_10px_22px_-18px_currentColor]", channel.tone)}>
                <ChannelIcon className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-sm", conversation.unread ? "font-semibold" : "font-medium")}>
                    {conversation.subject || "(no subject)"}
                  </p>
                  {conversation.status === "PINNED" && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  {conversation.status === "ARCHIVED" && (
                    <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>{channel.label}</span><span className="text-white/20">/</span><span>{conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "Awaiting first message"}</span>
                </p>
              </div>
              {conversation.priority !== "NORMAL" && (
                <Badge variant={PRIORITY_VARIANT[conversation.priority]} className="shrink-0 text-[10px]">
                  {conversation.priority}
                </Badge>
              )}
              {conversation.unread && <span aria-label="Unread" className="h-2 w-2 shrink-0 rounded-full bg-info shadow-[0_0_10px_hsl(var(--info)/0.9)]" />}
              <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
            </button>
          )})}
        </div>}
      </section>
    </div>
  );
}

function SignalCard({ label, value, tone, icon: Icon }: { label: string; value: number; tone: string; icon: typeof InboxIcon }) {
  return <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4 backdrop-blur"><div className="flex items-center justify-between"><p className="text-[11px] font-medium text-muted-foreground">{label}</p><Icon className={cn("h-4 w-4", tone)} /></div><p className={cn("mt-3 text-2xl font-semibold tracking-tight", tone)}>{value}</p></div>;
}
