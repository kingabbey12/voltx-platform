"use client";

import { type MouseEvent, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "framer-motion";
import { ArrowRight, Cloud, Globe2, Lock, Play, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "@/components/sections/dashboard-mockup";
import { siteConfig } from "@/config/site";

const trustBadges = [
  { icon: Lock, label: "Enterprise Security" },
  { icon: Zap, label: "Real-time AI" },
  { icon: Cloud, label: "Cloud Native" },
  { icon: Globe2, label: "Global" },
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
      className="relative overflow-hidden pb-[7.2rem] pt-[4.8rem] sm:pt-[7.2rem] md:pb-[9.6rem] md:pt-[9.6rem]"
    >
      {/* background layers */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
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
          className="text-balance mt-8 max-w-5xl text-[2.8rem] font-semibold leading-[1.04] tracking-tight sm:text-[4.7rem] md:text-[5.6rem]"
        >
          <span className="gradient-text">The AI Business</span>
          <br />
          <span className="gradient-text">Operating System</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-pretty mt-7 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-xl"
        >
          Replace dozens of business tools with one AI-powered operating system. AI agents,
          CRM, workflows, knowledge, meetings, and automation&mdash;all in one platform.
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
            <a href="#tour">
              <Play className="h-4 w-4" fill="currentColor" />
              See the product tour
            </a>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="mt-5 text-xs text-muted-foreground"
        >
          No credit card required &bull; Setup in under 5 minutes
        </motion.p>

        <motion.ul
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-x-7 gap-y-3"
        >
          {trustBadges.map((badge) => (
            <li
              key={badge.label}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
            >
              <badge.icon className="h-3.5 w-3.5 text-primary/70" />
              {badge.label}
            </li>
          ))}
        </motion.ul>
      </div>

      {/* Rendered outside .container (which caps at 1280px) so the enlarged
          mockup has room to actually grow past that width on large screens. */}
      <motion.div
        style={
          prefersReducedMotion
            ? undefined
            : {
                x: mockupX,
                y: mockupY,
                rotateX: mockupRotateX,
                rotateY: mockupRotateY,
                transformPerspective: 1600,
              }
        }
        className="mt-24 w-full sm:mt-28"
      >
        <DashboardMockup />
      </motion.div>
    </section>
  );
}
