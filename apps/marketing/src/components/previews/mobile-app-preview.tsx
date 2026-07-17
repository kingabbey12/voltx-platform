"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Bell, Bot, TrendingUp, Users, Zap } from "lucide-react";
import { useLoopStep } from "@/components/previews/preview-shell";
import { cn } from "@/lib/utils";

const listItems = [
  { icon: TrendingUp, title: "Pipeline value", value: "$2.4M" },
  { icon: Users, title: "Qualified leads", value: "38" },
  { icon: Bot, title: "AI conversations", value: "126" },
];

/**
 * The Voltx mobile app in a phone frame: a push notification slides in,
 * then dashboard rows settle into place. The frame floats gently —
 * transform-only, and frozen entirely under reduced motion.
 */
export function MobileAppPreview({ className }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion();
  const { ref, step } = useLoopStep(4, 1800);
  const notificationVisible = prefersReducedMotion || step >= 1;

  return (
    <div ref={ref} aria-hidden="true" className={cn("flex h-full w-full items-center justify-center", className)}>
      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, -8, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative h-[92%] max-h-[26rem] w-auto"
        style={{ aspectRatio: "9 / 19" }}
      >
        {/* glow */}
        <div
          aria-hidden
          className="absolute -inset-6 -z-10 rounded-full bg-primary/20 blur-3xl"
        />

        {/* phone frame */}
        <div className="flex h-full w-full flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-background shadow-[0_30px_80px_-30px_rgba(0,0,0,0.8)]">
          {/* status bar + notch */}
          <div className="relative flex shrink-0 items-center justify-center pb-1 pt-2">
            <div className="h-4 w-20 rounded-full bg-white/5" />
          </div>

          {/* notification */}
          <div className="relative h-12 shrink-0 px-2">
            <motion.div
              initial={false}
              animate={{
                opacity: notificationVisible ? 1 : 0,
                y: notificationVisible ? 0 : -16,
              }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="flex items-center gap-2 rounded-xl border border-white/10 bg-card/95 p-2 shadow-lg"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent">
                <Zap className="h-3 w-3 text-primary-foreground" fill="currentColor" strokeWidth={0} />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[9px] font-semibold text-foreground">
                  Deal moved to Closed Won
                </span>
                <span className="block truncate text-[8px] text-muted-foreground">
                  Meridian Labs · $86,000 · just now
                </span>
              </span>
              <Bell className="ml-auto h-3 w-3 shrink-0 text-primary" />
            </motion.div>
          </div>

          {/* app content */}
          <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 pb-3 pt-1">
            <span className="text-[10px] font-semibold text-foreground">Good morning, Alex</span>
            {listItems.map((item, index) => {
              const visible = prefersReducedMotion || step >= 2;
              return (
                <motion.div
                  key={item.title}
                  initial={false}
                  animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 10 }}
                  transition={{
                    duration: 0.4,
                    delay: visible && !prefersReducedMotion ? index * 0.1 : 0,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  className="flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] p-2.5"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                    <item.icon className="h-3 w-3" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[9px] text-muted-foreground">
                    {item.title}
                  </span>
                  <span className="font-mono text-[10px] font-semibold tabular-nums text-foreground">
                    {item.value}
                  </span>
                </motion.div>
              );
            })}

            {/* bottom nav */}
            <div className="mt-auto flex items-center justify-around rounded-xl border border-white/8 bg-white/[0.03] px-2 py-2">
              {[TrendingUp, Users, Bot, Bell].map((Icon, index) => (
                <Icon
                  key={index}
                  className={cn("h-3.5 w-3.5", index === 0 ? "text-primary" : "text-muted-foreground/60")}
                />
              ))}
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
