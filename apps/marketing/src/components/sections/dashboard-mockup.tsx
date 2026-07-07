"use client";

import { motion } from "framer-motion";
import {
  Bot,
  LayoutDashboard,
  MessageSquare,
  Search,
  Sparkles,
  TrendingUp,
  Users,
  Workflow,
  Zap,
} from "lucide-react";

const sidebarItems = [
  { icon: LayoutDashboard, active: true },
  { icon: Users, active: false },
  { icon: Workflow, active: false },
  { icon: Bot, active: false },
  { icon: MessageSquare, active: false },
];

const kpis = [
  { label: "Pipeline value", value: "$2.4M", delta: "+18.2%", up: true },
  { label: "Active agents", value: "12", delta: "+3", up: true },
  { label: "Avg. response", value: "1.2s", delta: "-40%", up: true },
];

const bars = [38, 54, 42, 68, 51, 74, 60, 82, 66, 90, 78, 96];

export function DashboardMockup() {
  return (
    <div aria-hidden="true" className="relative mx-auto w-full max-w-5xl">
      {/* ambient glow */}
      <div
        aria-hidden
        className="absolute -inset-x-10 -inset-y-16 -z-10 rounded-[3rem] bg-gradient-to-tr from-primary/25 via-accent/10 to-transparent blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, y: 60, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
        style={{ transformPerspective: 1400 }}
        className="shimmer-border relative overflow-hidden rounded-2xl border border-white/10 bg-card/60 shadow-[0_40px_120px_-40px_rgba(0,0,0,0.7)] backdrop-blur-2xl sm:rounded-3xl"
      >
        {/* window chrome */}
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3 sm:px-6">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-400/70" />
          <div className="ml-4 flex flex-1 items-center gap-2 rounded-full bg-white/5 px-3 py-1.5 text-xs text-muted-foreground">
            <Search className="h-3 w-3" />
            app.usevoltx.com/dashboard
          </div>
        </div>

        <div className="flex">
          {/* sidebar */}
          <div className="hidden w-16 flex-col items-center gap-4 border-r border-white/5 py-6 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Zap className="h-4 w-4 text-white" fill="currentColor" strokeWidth={0} />
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {sidebarItems.map((item, i) => (
                <div
                  key={i}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${
                    item.active ? "bg-primary/15 text-primary" : "text-muted-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                </div>
              ))}
            </div>
          </div>

          {/* main panel */}
          <div className="flex-1 p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Good morning, Alex</p>
                <p className="text-sm font-semibold text-foreground">Executive overview</p>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
                <Sparkles className="h-3 w-3" />
                AI Briefing ready
              </div>
            </div>

            {/* KPI row */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
              {kpis.map((kpi, i) => (
                <motion.div
                  key={kpi.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + i * 0.1 }}
                  className="rounded-xl border border-white/5 bg-white/[0.03] p-3 sm:p-4"
                >
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground sm:text-xs">
                    {kpi.label}
                  </p>
                  <div className="mt-1.5 flex items-baseline gap-1.5 sm:mt-2">
                    <span className="text-base font-semibold text-foreground sm:text-xl">
                      {kpi.value}
                    </span>
                    <span className="flex items-center gap-0.5 text-[10px] font-medium text-emerald-400 sm:text-xs">
                      <TrendingUp className="h-3 w-3" />
                      {kpi.delta}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-4 sm:grid-cols-5">
              {/* chart */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.9 }}
                className="col-span-3 rounded-xl border border-white/5 bg-white/[0.03] p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-medium text-foreground">Revenue forecast</p>
                  <span className="text-[10px] text-muted-foreground">Last 12 weeks</span>
                </div>
                <div className="flex h-24 items-end gap-1.5 sm:h-28">
                  {bars.map((h, i) => (
                    <motion.div
                      key={i}
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.7, delay: 1 + i * 0.04, ease: "easeOut" }}
                      className="flex-1 rounded-t-sm bg-gradient-to-t from-primary/40 to-accent/70"
                    />
                  ))}
                </div>
              </motion.div>

              {/* AI activity */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 1 }}
                className="col-span-2 flex flex-col gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-4"
              >
                <p className="text-xs font-medium text-foreground">Agent activity</p>
                <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/15">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">Sales Copilot</span> qualified 4
                    new leads and drafted follow-ups.
                  </p>
                </div>
                <div className="flex items-start gap-2 rounded-lg bg-white/[0.03] p-2.5">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/15">
                    <Workflow className="h-3.5 w-3.5 text-accent" />
                  </div>
                  <p className="text-[11px] leading-snug text-muted-foreground">
                    <span className="font-medium text-foreground">Onboarding workflow</span>{" "}
                    completed for Acme Inc.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* floating badges */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85, x: -20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 1.4 }}
        className="absolute -left-4 top-10 hidden animate-float rounded-2xl border border-white/10 bg-card/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:-left-10 sm:block"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/15">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Deal closed</p>
            <p className="text-[11px] text-muted-foreground">+$42,000 ARR</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.85, x: 20 }}
        animate={{ opacity: 1, scale: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 1.6 }}
        style={{ animationDelay: "1.5s" }}
        className="absolute -right-4 bottom-6 hidden animate-float rounded-2xl border border-white/10 bg-card/90 px-4 py-3 shadow-2xl backdrop-blur-xl sm:-right-10 sm:block"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-foreground">Meeting summarized</p>
            <p className="text-[11px] text-muted-foreground">3 action items created</p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
