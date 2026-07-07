"use client";

import { motion } from "framer-motion";
import { ArrowRight, Calendar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "@/components/sections/dashboard-mockup";
import { siteConfig } from "@/config/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-16 sm:pt-24 md:pb-32 md:pt-32">
      {/* background layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 surface-grid opacity-[0.35] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]" />
        <div className="absolute left-1/2 top-[-10%] h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-primary/25 blur-[140px]" />
        <div className="absolute right-[10%] top-[20%] h-[24rem] w-[24rem] rounded-full bg-accent/20 blur-[120px]" />
      </div>

      <div className="container flex flex-col items-center text-center">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-xs font-medium text-primary sm:text-sm">
            <Sparkles className="h-3.5 w-3.5" />
            Introducing autonomous multi-agent workflows
          </div>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="text-balance mt-7 max-w-4xl text-4xl font-semibold leading-[1.08] tracking-tight sm:text-6xl md:text-7xl"
        >
          <span className="gradient-text">The AI Business</span>
          <br />
          <span className="gradient-text">Operating System</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-pretty mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl"
        >
          AI agents, CRM, workflows, knowledge, meetings, and automation in one platform.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="mt-10 flex flex-col items-center gap-3 sm:flex-row"
        >
          <Button size="lg" asChild>
            <a href={siteConfig.appUrl}>
              Start Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <a href="/contact">
              <Calendar className="h-4 w-4" />
              Book Demo
            </a>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-5 text-xs text-muted-foreground"
        >
          No credit card required &middot; Free forever plan &middot; Setup in minutes
        </motion.p>

        <div className="mt-20 w-full sm:mt-24">
          <DashboardMockup />
        </div>
      </div>
    </section>
  );
}
