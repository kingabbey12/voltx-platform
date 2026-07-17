"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface WalkthroughStep {
  title: string;
  description: string;
  /** The visual shown while this step is active — an animated preview, video, or screenshot. */
  visual: ReactNode;
}

const AUTO_ADVANCE_MS = 5000;

/**
 * A step-by-step product walkthrough: numbered steps on one side, a
 * synced visual pane on the other. Steps auto-advance while the section
 * is on screen (never under reduced motion, and paused while the visitor
 * hovers or focuses the list — advancing a list someone is reading is
 * the opposite of polish), and any step can be jumped to directly.
 */
export function FeatureWalkthrough({
  steps,
  className,
  visualClassName,
}: {
  steps: WalkthroughStep[];
  className?: string;
  visualClassName?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [inView, setInView] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => setInView(entries[0]?.isIntersecting ?? false),
      { threshold: 0.35 },
    );
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  const shouldAutoAdvance = inView && !paused && !prefersReducedMotion && steps.length > 1;

  useEffect(() => {
    if (!shouldAutoAdvance) return;
    const timer = setInterval(
      () => setActiveIndex((index) => (index + 1) % steps.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearInterval(timer);
  }, [shouldAutoAdvance, steps.length]);

  const pause = useCallback(() => setPaused(true), []);
  const resume = useCallback(() => setPaused(false), []);

  return (
    <div
      ref={rootRef}
      className={cn("grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,26rem)_1fr] lg:gap-16", className)}
    >
      <ol
        className="flex flex-col gap-2"
        onMouseEnter={pause}
        onMouseLeave={resume}
        onFocusCapture={pause}
        onBlurCapture={resume}
      >
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={step.title}>
              <button
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "group relative w-full rounded-2xl border p-5 text-left transition-colors duration-300",
                  isActive
                    ? "border-primary/30 bg-primary/[0.06]"
                    : "border-transparent hover:bg-white/[0.03]",
                )}
              >
                <span className="flex items-start gap-4">
                  <span
                    className={cn(
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-semibold transition-colors duration-300",
                      isActive
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border text-muted-foreground group-hover:border-primary/40",
                    )}
                  >
                    {index + 1}
                  </span>
                  <span className="min-w-0">
                    <span
                      className={cn(
                        "block text-sm font-semibold transition-colors duration-300",
                        isActive ? "text-foreground" : "text-foreground/70",
                      )}
                    >
                      {step.title}
                    </span>
                    <span
                      className={cn(
                        "mt-1 block text-sm leading-relaxed transition-colors duration-300",
                        isActive ? "text-muted-foreground" : "text-muted-foreground/60",
                      )}
                    >
                      {step.description}
                    </span>
                  </span>
                </span>
                {isActive && shouldAutoAdvance ? (
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-5 right-5 h-px overflow-hidden rounded-full bg-border"
                  >
                    <motion.span
                      key={activeIndex}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: "linear" }}
                      className="block h-full origin-left bg-primary/70"
                    />
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ol>

      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-3xl border border-white/10 bg-card/60",
          visualClassName,
        )}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-10 -z-10 rounded-full bg-primary/15 blur-3xl"
        />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeIndex}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.985 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.01 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="h-full w-full"
          >
            {steps[activeIndex]?.visual}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
