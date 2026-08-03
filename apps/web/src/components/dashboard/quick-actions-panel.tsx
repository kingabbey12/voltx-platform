"use client";

import Link from "next/link";
import { ArrowUpRight, Building2, CircuitBoard, MessageCircleMore, Target, UserPlus, WandSparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ACCENTS, type Accent } from "@/lib/design-language";
import { cn } from "@/lib/utils";

const actions: Array<{ label: string; helper: string; href: string; icon: LucideIcon; accent: Accent }> = [
  { label: "AI chat", helper: "Ask Voltx anything", href: "/ai", icon: MessageCircleMore, accent: "purple" },
  { label: "Companies", helper: "Manage accounts", href: "/crm/companies", icon: Building2, accent: "blue" },
  { label: "Leads", helper: "Capture intent", href: "/crm/leads", icon: UserPlus, accent: "orange" },
  { label: "Automation", helper: "Orchestrate work", href: "/workflows", icon: WandSparkles, accent: "green" },
  { label: "Deals", helper: "Move revenue", href: "/crm/opportunities", icon: Target, accent: "gold" },
  { label: "Integrations", helper: "Connect systems", href: "/integrations", icon: CircuitBoard, accent: "cyan" },
];

export function QuickActionsPanel() {
  return (
    <section className="surface-widget flex h-full flex-col rounded-[24px] p-5 sm:p-6" aria-labelledby="quick-actions-title">
      <div className="flex items-center justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Act now</p><h2 id="quick-actions-title" className="mt-1 text-lg font-semibold">Quick actions</h2></div><span className="text-xs text-muted-foreground">6 essentials</span></div>
      <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
        {actions.map((action) => {
          const tokens = ACCENTS[action.accent];
          return <Link key={action.label} href={action.href} className={cn("group relative min-h-[124px] overflow-hidden rounded-2xl border p-3.5 transition-[border-color,background-color,box-shadow,transform] duration-300 hover:-translate-y-1", tokens.border, "bg-white/[0.018] hover:bg-white/[0.055] hover:shadow-[0_18px_26px_-20px_currentColor]")}> 
            <span aria-hidden className={cn("pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-70", tokens.bg)} />
            <span className={cn("relative grid h-10 w-10 place-items-center rounded-full border shadow-[0_10px_22px_-16px_currentColor] transition-transform duration-300 group-hover:scale-110", tokens.bg, tokens.border, tokens.fg)}><action.icon className="h-[18px] w-[18px]" /></span>
            <p className="relative mt-4 text-sm font-semibold">{action.label}</p><p className="relative mt-0.5 text-[11px] text-muted-foreground">{action.helper}</p><ArrowUpRight className={cn("absolute bottom-3.5 right-3.5 h-3.5 w-3.5 opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100", tokens.fg)} />
          </Link>;
        })}
      </div>
    </section>
  );
}