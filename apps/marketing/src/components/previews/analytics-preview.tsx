"use client";

import { motion, useReducedMotion } from "framer-motion";
import { TrendingUp } from "lucide-react";
import { PreviewShell, useLoopStep } from "@/components/previews/preview-shell";
import { cn } from "@/lib/utils";

const bars = [32, 48, 40, 62, 55, 74, 68, 88, 79, 96];
const kpiRows = [
  { label: "Pipeline value", value: "$2.4M", delta: "+18%" },
  { label: "Win rate", value: "34%", delta: "+6%" },
  { label: "Cycle time", value: "21d", delta: "-9d" },
];

/**
 * A revenue dashboard whose chart draws itself from zero: bars scale up
 * from the baseline (transform-only) and the trend line draws via
 * pathLength — both replay each loop pass. Under reduced motion the
 * chart renders complete and still.
 */
export function AnalyticsPreview() {
  const prefersReducedMotion = useReducedMotion();
  const { ref, step } = useLoopStep(4, 2200);
  // Step 0 resets the chart; steps 1+ show it drawn. Replaying the draw
  // once per loop keeps the section alive without constant motion.
  const drawn = prefersReducedMotion || step >= 1;

  // Polyline through bar tops, in the chart's 100x56 viewBox space.
  const linePoints = bars
    .map((height, index) => {
      const x = index * 10 + 5;
      const y = 56 - (height / 100) * 50;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div ref={ref} className="h-full w-full">
      <PreviewShell url="app.usevoltx.com/dashboard">
        <div className="flex h-full flex-col gap-3 p-3 sm:flex-row sm:p-4">
          {/* chart panel */}
          <div className="flex min-w-0 flex-[1.6] flex-col rounded-xl border border-white/8 bg-white/[0.02] p-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Revenue
              </span>
              <span className="flex items-center gap-1 font-mono text-[10px] text-success">
                <TrendingUp className="h-3 w-3" />
                +24.6%
              </span>
            </div>
            <div className="relative mt-2 min-h-0 flex-1">
              <svg className="h-full w-full" viewBox="0 0 100 56" preserveAspectRatio="none">
                {bars.map((height, index) => (
                  <motion.rect
                    key={index}
                    x={index * 10 + 1.5}
                    width={7}
                    y={56 - (height / 100) * 50}
                    height={(height / 100) * 50}
                    rx={1}
                    fill="hsl(var(--primary) / 0.35)"
                    initial={false}
                    animate={{ scaleY: drawn ? 1 : 0 }}
                    transition={{
                      duration: 0.6,
                      delay: drawn ? index * 0.05 : 0,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                    style={{ transformOrigin: "50% 100%", transformBox: "fill-box" }}
                  />
                ))}
                <motion.polyline
                  points={linePoints}
                  fill="none"
                  stroke="hsl(var(--accent))"
                  strokeWidth="1"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={false}
                  animate={{ pathLength: drawn ? 1 : 0.001, opacity: drawn ? 1 : 0 }}
                  transition={{ duration: 1, delay: drawn ? 0.3 : 0, ease: "easeInOut" }}
                />
              </svg>
            </div>
          </div>

          {/* KPI rail */}
          <div className="flex flex-1 flex-row gap-2 sm:flex-col sm:gap-3">
            {kpiRows.map((kpi, index) => (
              <motion.div
                key={kpi.label}
                initial={false}
                animate={{ opacity: drawn ? 1 : 0.35, y: drawn ? 0 : 4 }}
                transition={{ duration: 0.5, delay: drawn ? 0.4 + index * 0.1 : 0 }}
                className="min-w-0 flex-1 rounded-xl border border-white/8 bg-white/[0.02] p-2.5 sm:flex-none sm:p-3"
              >
                <span className="block truncate text-[9px] uppercase tracking-wide text-muted-foreground sm:text-[10px]">
                  {kpi.label}
                </span>
                <span className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground sm:text-base">
                    {kpi.value}
                  </span>
                  <span
                    className={cn(
                      "font-mono text-[9px] sm:text-[10px]",
                      kpi.delta.startsWith("-") && kpi.label !== "Cycle time"
                        ? "text-destructive"
                        : "text-success",
                    )}
                  >
                    {kpi.delta}
                  </span>
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </PreviewShell>
    </div>
  );
}
