"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowRight, Play, Sparkles } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "@/components/sections/dashboard-mockup";

const HeroNeuralField = dynamic(
  () => import("@/components/three/hero-neural-field").then((module) => module.HeroNeuralField),
  { ssr: false },
);

export function FeaturesHero() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden pb-16 pt-12 sm:pb-24 sm:pt-20 lg:pb-32 lg:pt-28">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 surface-grid opacity-30 [mask-image:radial-gradient(ellipse_65%_65%_at_66%_35%,#000_0%,transparent_70%)]" />
        <div className="absolute -right-[12%] top-0 hidden h-full w-[65%] opacity-75 lg:block"><HeroNeuralField /></div>
        <div className="absolute left-[5%] top-[18%] h-72 w-72 rounded-full bg-primary/15 blur-[120px]" />
      </div>
      <div className="container grid items-center gap-12 lg:grid-cols-[0.83fr_1.17fr] lg:gap-14">
        <div className="max-w-2xl">
          <motion.div initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.5 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary"><Sparkles className="h-3.5 w-3.5" /> Product capabilities</span>
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.08 }} className="text-balance mt-6 text-4xl font-semibold leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
            Everything Your Business Needs.<br /><span className="gradient-text">One Intelligent Platform.</span>
          </motion.h1>
          <motion.p initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.16 }} className="text-pretty mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Voltx combines CRM, AI, communications, automation, analytics, knowledge, and executive intelligence into one AI Business Operating System.
          </motion.p>
          <motion.div initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.24 }} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild><Link href="/join-beta">Start Free Trial <ArrowRight className="h-4 w-4" /></Link></Button>
            <Button size="lg" variant="secondary" asChild><Link href="/book-demo">Book Demo</Link></Button>
          </motion.div>
          <a href="#chief-of-staff" className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/65 transition-colors hover:text-white"><Play className="h-3.5 w-3.5 fill-current" /> Explore the platform</a>
        </div>
        <motion.div initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: prefersReducedMotion ? 0 : 0.85, delay: prefersReducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }} className="min-w-0 lg:pt-4">
          <DashboardMockup />
        </motion.div>
      </div>
    </section>
  );
}