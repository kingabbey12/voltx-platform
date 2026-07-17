"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Shared scaffold for the animated product previews: browser-window
 * chrome matching the hero's DashboardMockup, so every feature section
 * reads as the same product. Previews are decorative (aria-hidden) —
 * the adjacent copy carries the information.
 */
export function PreviewShell({
  children,
  url = "app.usevoltx.com",
  className,
  chrome = true,
}: {
  children: ReactNode;
  url?: string;
  className?: string;
  chrome?: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-card/70 backdrop-blur-xl",
        className,
      )}
    >
      {chrome ? (
        <div className="flex shrink-0 items-center gap-2 border-b border-white/5 px-4 py-2.5">
          <span className="h-2 w-2 rounded-full bg-red-400/70" />
          <span className="h-2 w-2 rounded-full bg-yellow-400/70" />
          <span className="h-2 w-2 rounded-full bg-green-400/70" />
          <div className="ml-3 flex-1 truncate rounded-full bg-white/5 px-3 py-1 font-mono text-[10px] text-muted-foreground">
            {url}
          </div>
        </div>
      ) : null}
      <div className="relative min-h-0 flex-1">{children}</div>
    </div>
  );
}

/**
 * Cycles 0..stepCount-1 while the element is on screen. Returns the ref
 * to attach plus the current step. Under reduced motion the step is
 * pinned to the final state so previews render as a finished still
 * rather than an animation.
 */
export function useLoopStep(stepCount: number, intervalMs = 1600) {
  const prefersReducedMotion = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.3 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !inView) return;
    const timer = setInterval(() => setStep((current) => (current + 1) % stepCount), intervalMs);
    return () => clearInterval(timer);
  }, [prefersReducedMotion, inView, stepCount, intervalMs]);

  return {
    ref,
    step: prefersReducedMotion ? stepCount - 1 : step,
    animating: !prefersReducedMotion,
  };
}
