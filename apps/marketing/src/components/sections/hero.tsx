"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { type MouseEvent, useRef, useState } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CircleDollarSign,
  Play,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const HeroNeuralField = dynamic(
  () => import("@/components/three/hero-neural-field").then((module) => module.HeroNeuralField),
  { ssr: false },
);

const dashboardViews = [
  { id: "brief", label: "Executive brief", icon: BriefcaseBusiness },
  { id: "revenue", label: "Revenue", icon: CircleDollarSign },
  { id: "pipeline", label: "Pipeline", icon: BarChart3 },
] as const;

const dashboardContent = {
  brief: {
    eyebrow: "Monday, 9:42 AM",
    title: "Your business, in focus.",
    copy: "Pipeline is ahead of plan. Two strategic deals need an executive decision today.",
    metric: "3",
    metricLabel: "priorities ready",
  },
  revenue: {
    eyebrow: "Q3 forecast",
    title: "$2.4M projected revenue",
    copy: "Forecast confidence is 86%, up 8 points from last month.",
    metric: "+18.2%",
    metricLabel: "vs. last quarter",
  },
  pipeline: {
    eyebrow: "Live pipeline",
    title: "$1.18M in active opportunities",
    copy: "AI has identified four deals that need a next step this week.",
    metric: "4",
    metricLabel: "deals at risk",
  },
};

function ExecutivePreview() {
  const [activeView, setActiveView] = useState<(typeof dashboardViews)[number]["id"]>("brief");
  const content = dashboardContent[activeView];

  return (
    <div className="relative mx-auto w-full max-w-[43rem]">
      <div aria-hidden className="absolute -inset-8 -z-10 bg-primary/15 blur-[80px]" />
      <div className="relative overflow-hidden rounded-xl border border-white/15 bg-[#151411]/90 shadow-[0_32px_90px_-32px_rgba(0,0,0,0.9)] backdrop-blur-2xl sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Zap className="h-3.5 w-3.5 fill-current" />
            </span>
            <span className="text-xs font-semibold tracking-wide text-white">Voltx</span>
          </div>
          <span className="rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">
            AI Chief of Staff
          </span>
        </div>

        <div className="grid min-h-[25rem] grid-cols-[8.75rem_1fr] sm:min-h-[29rem] sm:grid-cols-[10.5rem_1fr]">
          <div className="border-r border-white/[0.08] px-2 py-3 sm:px-3 sm:py-4">
            <p className="px-2 pb-2 text-[9px] font-medium uppercase tracking-[0.16em] text-white/35">Overview</p>
            <div className="space-y-1">
              {dashboardViews.map((view) => {
                const Icon = view.icon;
                const active = view.id === activeView;
                return (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setActiveView(view.id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[10px] transition-colors sm:text-xs ${
                      active ? "bg-primary/15 text-primary" : "text-white/50 hover:bg-white/[0.05] hover:text-white/80"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{view.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="mt-7 border-t border-white/[0.08] px-2 pt-4">
              <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">Connected</p>
              <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/55">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> All systems live
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.15em] text-primary/80">{content.eyebrow}</p>
                <h2 className="mt-2 max-w-sm text-lg font-medium leading-tight text-white sm:text-2xl">{content.title}</h2>
              </div>
              <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            </div>
            <p className="mt-3 max-w-sm text-xs leading-relaxed text-white/55 sm:text-sm">{content.copy}</p>

            <div className="mt-5 rounded-lg border border-primary/20 bg-primary/[0.08] p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] text-white/45">{content.metricLabel}</p>
                  <p className="mt-1 text-xl font-medium text-white sm:text-2xl">{content.metric}</p>
                </div>
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/15 text-primary">
                  <ChevronRight className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-white">AI recommendations</p>
                <span className="text-[10px] text-primary">View all</span>
              </div>
              <div className="mt-3 space-y-2">
                {["Review Meridian proposal", "Approve renewal exception", "Launch customer follow-up"].map((item, index) => (
                  <div key={item} className="flex items-center gap-2 text-[10px] text-white/60 sm:text-xs">
                    <span className={`h-1.5 w-1.5 rounded-full ${index === 0 ? "bg-primary" : "bg-white/25"}`} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden max-w-[13rem] rounded-lg border border-white/10 bg-[#1a1915]/95 p-3 shadow-2xl backdrop-blur-xl sm:block">
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary"><Sparkles className="h-3 w-3" /></span>
          <p className="text-[10px] leading-relaxed text-white/65"><strong className="font-medium text-white">Copilot:</strong> Your executive brief is ready.</p>
        </div>
      </div>
    </div>
  );
}

const trustBadges = [
  { icon: ShieldCheck, label: "Enterprise security" },
  { icon: Check, label: "Human-governed AI" },
  { icon: Zap, label: "One intelligent system" },
];

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springConfig = { stiffness: 120, damping: 20, mass: 0.5 };
  const springX = useSpring(pointerX, springConfig);
  const springY = useSpring(pointerY, springConfig);

  // Subtle parallax: the mockup drifts a few pixels toward the cursor and
  // tilts slightly, while the background glow drifts the opposite way for
  // depth. Disabled entirely when the user prefers reduced motion.
  const mockupX = useTransform(springX, [-1, 1], [-16, 16]);
  const mockupY = useTransform(springY, [-1, 1], [-10, 10]);
  const mockupRotateX = useTransform(springY, [-1, 1], [3, -3]);
  const mockupRotateY = useTransform(springX, [-1, 1], [-3, 3]);
  const glowPrimaryX = useTransform(springX, [-1, 1], [12, -12]);
  const glowPrimaryY = useTransform(springY, [-1, 1], [12, -12]);
  const glowAccentX = useTransform(springY, [-1, 1], [10, -10]);
  const glowAccentY = useTransform(springX, [-1, 1], [-10, 10]);

  function handleMouseMove(event: MouseEvent<HTMLElement>) {
    if (prefersReducedMotion || !sectionRef.current) return;
    const bounds = sectionRef.current.getBoundingClientRect();
    const relativeX = (event.clientX - bounds.left) / bounds.width - 0.5;
    const relativeY = (event.clientY - bounds.top) / bounds.height - 0.5;
    pointerX.set(relativeX * 2);
    pointerY.set(relativeY * 2);
  }

  function handleMouseLeave() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <section
      ref={sectionRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative overflow-hidden pb-20 pt-10 sm:pt-16 md:pb-28 md:pt-24"
    >
      {/* background layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-y-0 right-0 hidden w-[58%] opacity-80 lg:block">
          <HeroNeuralField />
        </div>
        <div className="absolute inset-0 surface-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]" />
        <motion.div
          style={prefersReducedMotion ? undefined : { x: glowPrimaryX, y: glowPrimaryY }}
          className="absolute left-1/2 top-[-10%] h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]"
        />
        <motion.div
          style={prefersReducedMotion ? undefined : { x: glowAccentX, y: glowAccentY }}
          className="absolute right-[10%] top-[20%] h-[24rem] w-[24rem] rounded-full bg-accent/20 blur-[120px]"
        />
      </div>

      <div className="container grid items-center gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-10">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              One platform. One intelligent operating layer.
            </div>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="text-balance mt-7 text-[2.8rem] font-semibold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
            <span className="gradient-text">The AI Business</span><br />
            <span className="text-white">Operating System</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.2 }} className="text-pretty mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Run your CRM, AI, communications, workflows, analytics, and business operations from one intelligent platform.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.3 }} className="mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            <Button size="lg" asChild><Link href="/join-beta">Start Free Trial <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button size="lg" variant="secondary" asChild><Link href="/book-demo">Book Demo</Link></Button>
            <a href="#tour" className="inline-flex min-h-11 items-center justify-center gap-2 px-3 text-sm font-medium text-white/70 transition-colors hover:text-white"><Play className="h-3.5 w-3.5 fill-current" /> Watch demo</a>
          </motion.div>
          <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.7, delay: 0.4 }} className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2">
            {trustBadges.map((badge) => <li key={badge.label} className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><badge.icon className="h-3.5 w-3.5 text-primary/80" />{badge.label}</li>)}
          </motion.ul>
        </div>
        <motion.div style={prefersReducedMotion ? undefined : { x: mockupX, y: mockupY, rotateX: mockupRotateX, rotateY: mockupRotateY, transformPerspective: 1600 }} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}>
          <ExecutivePreview />
        </motion.div>
      </div>
    </section>
  );
}
