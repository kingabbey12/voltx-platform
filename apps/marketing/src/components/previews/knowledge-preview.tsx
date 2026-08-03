"use client";

import { motion } from "framer-motion";
import { FileText, Network, Search, Sparkles } from "lucide-react";
import { PreviewShell, useLoopStep } from "@/components/previews/preview-shell";

const sources = ["Customer onboarding policy", "Meridian Labs notes", "Sales playbook v3"];

export function KnowledgePreview() {
  const { ref, step } = useLoopStep(4, 1800);
  const answerReady = step >= 2;

  return (
    <div ref={ref} className="h-full w-full">
      <PreviewShell url="app.usevoltx.com/knowledge/search">
        <div className="flex h-full flex-col p-3 sm:p-4">
          <div className="flex items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.03] px-3 py-2 text-[10px] text-muted-foreground sm:text-xs"><Search className="h-3.5 w-3.5 text-primary" /><span>What does the onboarding policy require?</span></div>
          <div className="mt-3 grid min-h-0 flex-1 gap-3 sm:grid-cols-[1.1fr_0.9fr]">
            <motion.div initial={false} animate={{ opacity: answerReady ? 1 : 0.35, y: answerReady ? 0 : 5 }} className="rounded-lg border border-primary/20 bg-primary/[0.06] p-3"><div className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-primary"><Sparkles className="h-3 w-3" /> Grounded answer</div><p className="mt-2 text-[10px] leading-relaxed text-white/70 sm:text-xs">The policy requires a named owner, workspace access, an approved implementation plan, and a 30-day adoption review.</p><div className="mt-3 flex flex-wrap gap-1">{["Policy", "Notes", "Playbook"].map((source) => <span key={source} className="rounded border border-white/[0.1] px-1.5 py-0.5 text-[8px] text-muted-foreground">{source}</span>)}</div></motion.div>
            <div className="rounded-lg bg-white/[0.03] p-2.5"><p className="flex items-center gap-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground"><Network className="h-3 w-3 text-primary" /> Connected sources</p><div className="mt-2.5 space-y-2">{sources.map((source) => <div key={source} className="flex items-center gap-1.5"><FileText className="h-3 w-3 text-muted-foreground" /><span className="truncate text-[9px] text-white/65 sm:text-[10px]">{source}</span><span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary/70" /></div>)}</div></div>
          </div>
        </div>
      </PreviewShell>
    </div>
  );
}