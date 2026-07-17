"use client";

import { motion } from "framer-motion";
import { Bot, GitBranch, Mail, MessageSquare, Zap, type LucideIcon } from "lucide-react";
import { PreviewShell, useLoopStep } from "@/components/previews/preview-shell";
import { cn } from "@/lib/utils";

interface FlowNode {
  icon: LucideIcon;
  label: string;
  sublabel: string;
  /** Percentage position inside the canvas. */
  x: number;
  y: number;
  /** Which loop step lights this node up. */
  activeAt: number;
}

const nodes: FlowNode[] = [
  { icon: Zap, label: "Trigger", sublabel: "New lead created", x: 8, y: 38, activeAt: 0 },
  { icon: Bot, label: "AI Agent", sublabel: "Qualify + enrich", x: 36, y: 38, activeAt: 1 },
  { icon: GitBranch, label: "Condition", sublabel: "Score > 70?", x: 63, y: 38, activeAt: 2 },
  { icon: Mail, label: "Send intro", sublabel: "Personalized email", x: 86, y: 14, activeAt: 3 },
  { icon: MessageSquare, label: "Notify rep", sublabel: "Slack #sales", x: 86, y: 64, activeAt: 3 },
];

// Straight connectors between node centers, in the same percentage space.
const edges = [
  { from: 0, to: 1, activeAt: 1 },
  { from: 1, to: 2, activeAt: 2 },
  { from: 2, to: 3, activeAt: 3 },
  { from: 2, to: 4, activeAt: 3 },
];

/**
 * A workflow run animating through the graph: trigger fires, the agent
 * node works, the condition branches, both actions execute. Node
 * highlights and edge draws are staged off the shared loop step.
 */
export function WorkflowsPreview() {
  const { ref, step } = useLoopStep(5, 1300);

  return (
    <div ref={ref} className="h-full w-full">
      <PreviewShell url="app.usevoltx.com/workflows/builder">
        <div className="relative h-full w-full p-2">
          <svg
            className="absolute inset-0 h-full w-full"
            viewBox="0 0 100 80"
            preserveAspectRatio="none"
          >
            {edges.map((edge) => {
              const from = nodes[edge.from];
              const to = nodes[edge.to];
              if (!from || !to) return null;
              const lit = step >= edge.activeAt;
              return (
                <motion.line
                  key={`${edge.from}-${edge.to}`}
                  x1={from.x + 6}
                  y1={from.y + 6}
                  x2={to.x + 6}
                  y2={to.y + 6}
                  stroke={lit ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth="0.5"
                  initial={false}
                  animate={{ pathLength: lit ? 1 : 0.001, opacity: lit ? 1 : 0.5 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              );
            })}
          </svg>

          {nodes.map((node) => {
            const lit = step >= node.activeAt;
            const running = step === node.activeAt;
            return (
              <motion.div
                key={node.label}
                initial={false}
                animate={{ scale: running ? 1.06 : 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className={cn(
                  "absolute flex w-[26%] min-w-0 items-center gap-1.5 rounded-lg border p-1.5 sm:gap-2 sm:p-2",
                  lit
                    ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.6)]"
                    : "border-white/10 bg-card/90",
                )}
                style={{ left: `${node.x}%`, top: `${node.y}%` }}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-md sm:h-6 sm:w-6",
                    lit ? "bg-primary/20 text-primary" : "bg-white/5 text-muted-foreground",
                  )}
                >
                  <node.icon className="h-3 w-3" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[9px] font-semibold text-foreground/90 sm:text-[10px]">
                    {node.label}
                  </span>
                  <span className="block truncate text-[8px] text-muted-foreground sm:text-[9px]">
                    {node.sublabel}
                  </span>
                </span>
              </motion.div>
            );
          })}

          {/* run status pill */}
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2">
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] transition-colors duration-300 sm:text-[10px]",
                step >= 4
                  ? "border-success/30 bg-success/10 text-success"
                  : "border-primary/25 bg-primary/10 text-primary",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  step >= 4 ? "bg-success" : "animate-pulse bg-primary",
                )}
              />
              {step >= 4 ? "Run completed · 1.8s" : "Running…"}
            </div>
          </div>
        </div>
      </PreviewShell>
    </div>
  );
}
