"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Bot, BriefcaseBusiness, Headphones, Landmark, Megaphone, Settings2, TrendingUp } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";

const assistants = [
  { name: "CEO Assistant", icon: BriefcaseBusiness, responsibility: "Surfaces the priorities that need executive attention.", action: "Prepare this week’s executive brief" },
  { name: "Sales Assistant", icon: TrendingUp, responsibility: "Keeps opportunities moving with informed follow-through.", action: "Draft follow-ups for at-risk deals" },
  { name: "Marketing Assistant", icon: Megaphone, responsibility: "Turns customer signals into campaigns your team can approve.", action: "Build a renewal audience" },
  { name: "Finance Assistant", icon: Landmark, responsibility: "Brings revenue and account context to the people making decisions.", action: "Flag renewal exceptions" },
  { name: "Operations Assistant", icon: Settings2, responsibility: "Coordinates repeatable work across systems, teams, and approvals.", action: "Route a high-priority approval" },
  { name: "Customer Support Assistant", icon: Headphones, responsibility: "Finds account context fast and proposes consistent responses.", action: "Summarize a customer conversation" },
];

export function AiTeamSection() {
  const [active, setActive] = useState(0);
  const activeAssistant = assistants[active]!;

  return (
    <section className="relative overflow-hidden py-24 sm:py-32">
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_76%_48%,hsl(var(--primary)/0.12),transparent_27rem)]" />
      <div className="container">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
          <div className="max-w-xl">
            <SectionEyebrow>Your AI team</SectionEyebrow>
            <Reveal delay={0.05}><h2 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">Expert help, connected to the work that matters.</h2></Reveal>
            <Reveal delay={0.1}><p className="text-pretty mt-5 text-lg leading-relaxed text-muted-foreground">Give every functional leader an AI counterpart that can understand your business context, prepare work, and bring decisions to the right person.</p></Reveal>
          </div>
          <Reveal delay={0.1}>
            <div className="grid overflow-hidden rounded-xl border border-white/10 bg-card/50 sm:grid-cols-[13rem_1fr]">
              <div className="border-b border-white/[0.08] p-2 sm:border-b-0 sm:border-r sm:p-3">
                <div className="grid grid-cols-2 gap-1 sm:block sm:space-y-1">
                  {assistants.map((assistant, index) => {
                    const Icon = assistant.icon;
                    const isActive = active === index;
                    return <button key={assistant.name} type="button" onClick={() => setActive(index)} className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-xs transition-colors ${isActive ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-white/[0.04] hover:text-white"}`}><Icon className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{assistant.name}</span></button>;
                  })}
                </div>
              </div>
              <div className="relative min-h-[16rem] p-5 sm:p-7">
                <motion.div key={activeAssistant.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
                  <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary"><activeAssistant.icon className="h-5 w-5" /></div>
                  <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.16em] text-primary">AI specialist</p>
                  <h3 className="mt-2 text-xl font-medium text-white">{activeAssistant.name}</h3>
                  <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">{activeAssistant.responsibility}</p>
                  <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.03] p-3 text-xs text-white/70"><Bot className="h-4 w-4 shrink-0 text-primary" /> <span>{activeAssistant.action}</span></div>
                </motion.div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}