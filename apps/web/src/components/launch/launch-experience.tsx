"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/** Bumping the version replays the launch animation for everyone once —
 * e.g. after a rebrand. */
const STORAGE_KEY = "voltx.launch.v1.seen";

/** When the overlay starts handing off to the dashboard. Total on-screen
 * time is this plus the ~450ms exit fade — well inside the 3s budget. */
const EXIT_AT_MS = 2050;

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * First-launch ceremony: bolt draws itself in over a blooming glow, an
 * energy pulse rings out, the wordmark settles, a hairline loader fills,
 * then the whole thing fades into the dashboard.
 *
 * - Plays exactly once per browser profile (localStorage-gated), so
 *   returning users never wait on it.
 * - Skipped entirely under prefers-reduced-motion (the flag is still
 *   set — switching the preference off later shouldn't replay it).
 * - Click, Escape, or any key skips straight to the handoff.
 * - Mounted above the shell as a fixed overlay: the dashboard renders
 *   and settles beneath it, so there is zero layout shift on reveal.
 */
export function LaunchExperience() {
  const prefersReducedMotion = useReducedMotion();
  const [phase, setPhase] = useState<"idle" | "playing" | "leaving">("idle");

  // useLayoutEffect so the decision to show happens before first paint —
  // first-time users never glimpse the dashboard behind the overlay, and
  // SSR HTML (which renders nothing) stays hydration-consistent.
  useLayoutEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
      if (prefersReducedMotion) return;
      setPhase("playing");
    } catch {
      // Storage unavailable (private mode, blocked) — never block entry.
    }
  }, [prefersReducedMotion]);

  const leave = useCallback(() => {
    setPhase((current) => (current === "playing" ? "leaving" : current));
  }, []);

  useEffect(() => {
    if (phase !== "playing") return;
    const timer = window.setTimeout(leave, EXIT_AT_MS);
    const onKeyDown = () => leave();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [phase, leave]);

  return (
    <AnimatePresence>
      {phase === "playing" ? (
        <motion.div
          key="launch"
          aria-hidden="true"
          onClick={leave}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background"
        >
          <motion.div
            exit={{ scale: 0.96, transition: { duration: 0.45, ease: "easeInOut" } }}
            className="relative flex flex-col items-center"
          >
            {/* soft glow bloom */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: [0, 1, 0.7], scale: [0.6, 1.15, 1] }}
              transition={{ duration: 1.4, ease: "easeOut", times: [0, 0.55, 1] }}
              className="absolute -inset-24 rounded-full bg-primary/25 blur-3xl"
            />

            {/* energy pulse rings */}
            {[0, 1].map((ring) => (
              <motion.div
                key={ring}
                initial={{ opacity: 0, scale: 0.55 }}
                animate={{ opacity: [0, 0.5, 0], scale: [0.55, 2 + ring * 0.6] }}
                transition={{ duration: 1.1, delay: 0.85 + ring * 0.18, ease: "easeOut" }}
                className="absolute h-28 w-28 rounded-full border border-primary/50"
              />
            ))}

            {/* logo mark: outline draws itself, then the fill lands */}
            <motion.div
              initial={{ opacity: 0, scale: 0.86 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, ease: EASE }}
              className="relative flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-gradient-to-br from-primary to-accent shadow-[0_0_80px_-12px_hsl(var(--primary)/0.9)]"
            >
              <svg width="52" height="52" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <motion.path
                  d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"
                  stroke="hsl(var(--primary-foreground))"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.8, delay: 0.15, ease: "easeInOut" }}
                />
                <motion.path
                  d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z"
                  fill="hsl(var(--primary-foreground))"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.35, delay: 0.85, ease: "easeOut" }}
                />
              </svg>
            </motion.div>

            {/* wordmark */}
            <motion.p
              initial={{ opacity: 0, y: 10, letterSpacing: "0.3em" }}
              animate={{ opacity: 1, y: 0, letterSpacing: "0.08em" }}
              transition={{ duration: 0.6, delay: 1.05, ease: EASE }}
              className="mt-7 font-heading text-2xl font-semibold uppercase text-foreground"
            >
              Voltx
            </motion.p>

            {/* hairline loading indicator */}
            <div className="mt-6 h-px w-28 overflow-hidden rounded-full bg-border">
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 0.75, delay: 1.25, ease: "easeInOut" }}
                className="h-full origin-left bg-primary"
              />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
