"use client";

import { motion } from "framer-motion";
import { Mail, MessageCircle, MoreHorizontal, Send, Sparkles } from "lucide-react";
import { PreviewShell, useLoopStep } from "@/components/previews/preview-shell";
import { cn } from "@/lib/utils";

const conversations = [
  { name: "Dana at Meridian", channel: Mail, summary: "Proposal feedback", active: true },
  { name: "Atlas Freight", channel: MessageCircle, summary: "Onboarding question" },
  { name: "Northwind Retail", channel: Mail, summary: "Renewal review" },
];

export function CommunicationsPreview() {
  const { ref, step } = useLoopStep(4, 1800);
  const replyReady = step >= 2;

  return (
    <div ref={ref} className="h-full w-full">
      <PreviewShell url="app.usevoltx.com/inbox">
        <div className="grid h-full grid-cols-[0.8fr_1.2fr]">
          <div className="border-r border-white/[0.08] p-2.5 sm:p-3">
            <p className="px-1 pb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Unified inbox</p>
            <div className="space-y-1">
              {conversations.map((conversation) => <div key={conversation.name} className={cn("rounded-md p-2", conversation.active ? "bg-primary/10" : "")}><div className="flex items-center gap-1.5"><conversation.channel className={cn("h-3 w-3", conversation.active ? "text-primary" : "text-muted-foreground")} /><span className="truncate text-[10px] font-medium text-foreground/90 sm:text-xs">{conversation.name}</span></div><p className="mt-1 truncate text-[9px] text-muted-foreground sm:text-[10px]">{conversation.summary}</p></div>)}
            </div>
          </div>
          <div className="flex min-w-0 flex-col p-3 sm:p-4">
            <div className="flex items-center justify-between border-b border-white/[0.08] pb-2.5"><div><p className="text-[10px] font-medium text-foreground sm:text-xs">Dana at Meridian</p><p className="mt-0.5 text-[9px] text-muted-foreground">Email · CRM history connected</p></div><MoreHorizontal className="h-4 w-4 text-muted-foreground" /></div>
            <div className="mt-3 rounded-lg bg-white/[0.04] p-2.5 text-[10px] leading-relaxed text-white/65 sm:text-xs">Thanks for the thoughtful proposal. Can you confirm the timeline for rolling out to our sales team?</div>
            <motion.div initial={false} animate={{ opacity: replyReady ? 1 : 0.32, y: replyReady ? 0 : 4 }} className="mt-auto rounded-lg border border-primary/25 bg-primary/[0.07] p-2.5"><div className="flex items-center gap-1.5 text-[9px] font-medium text-primary"><Sparkles className="h-3 w-3" /> AI reply</div><p className="mt-1 text-[10px] leading-relaxed text-white/70 sm:text-xs">Absolutely. Based on your rollout plan, we recommend a phased launch beginning with the sales leadership team.</p><div className="mt-2 flex items-center gap-1 text-[9px] text-primary"><Send className="h-3 w-3" /> Ready for review</div></motion.div>
          </div>
        </div>
      </PreviewShell>
    </div>
  );
}