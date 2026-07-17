"use client";

import { useId, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export interface DemoPane {
  label: string;
  /** Pre-rendered icon node (not a component), so panes can cross the RSC boundary. */
  icon?: ReactNode;
  content: ReactNode;
}

/**
 * "See it in action" container: an accessible tab strip over a live pane.
 * Panes hold whatever demonstrates the feature best — an animated
 * preview, a ProductVideo, or a real interactive fragment. The active-tab
 * indicator is a shared-layout element so switching feels physical rather
 * than like a repaint.
 */
export function InteractiveDemo({
  panes,
  className,
  ariaLabel = "Product demo",
}: {
  panes: DemoPane[];
  className?: string;
  ariaLabel?: string;
}) {
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const baseId = useId();

  return (
    <div className={cn("overflow-hidden rounded-3xl border border-white/10 bg-card/50", className)}>
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto border-b border-white/10 bg-background/40 p-2 scrollbar-none"
      >
        {panes.map((pane, index) => {
          const isActive = index === activeIndex;
          return (
            <button
              key={pane.label}
              type="button"
              role="tab"
              id={`${baseId}-tab-${index}`}
              aria-selected={isActive}
              aria-controls={`${baseId}-panel-${index}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActiveIndex(index)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight") {
                  setActiveIndex((activeIndex + 1) % panes.length);
                } else if (event.key === "ArrowLeft") {
                  setActiveIndex((activeIndex - 1 + panes.length) % panes.length);
                }
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-300",
                isActive ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive ? (
                <motion.span
                  layoutId={`${baseId}-indicator`}
                  transition={
                    prefersReducedMotion
                      ? { duration: 0 }
                      : { type: "spring", stiffness: 400, damping: 34 }
                  }
                  className="absolute inset-0 rounded-xl bg-primary"
                  aria-hidden
                />
              ) : null}
              <span className="relative flex items-center gap-2">
                {pane.icon}
                {pane.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative aspect-[16/10] sm:aspect-[16/9]">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeIndex}
            role="tabpanel"
            id={`${baseId}-panel-${activeIndex}`}
            aria-labelledby={`${baseId}-tab-${activeIndex}`}
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0"
          >
            {panes[activeIndex]?.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
