"use client";

import { motion } from "framer-motion";
import { Bot, CheckCircle2, FileText, Mail, Search, Sparkles } from "lucide-react";
import { PreviewShell, useLoopStep } from "@/components/previews/preview-shell";
import { cn } from "@/lib/utils";

const toolCalls = [
  { icon: Search, label: "Searching CRM for Meridian Labs" },
  { icon: FileText, label: "Reading last 3 meeting notes" },
  { icon: Mail, label: "Drafting follow-up email" },
];

/**
 * An agent run, compressed: the user asks, the agent works through its
 * tool calls one at a time, then delivers the finished result. Steps:
 * 0 user message → 1-3 tool calls appear → 4 final response.
 */
export function AiAutomationPreview() {
  const { ref, step } = useLoopStep(6, 1400);

  return (
    <div ref={ref} className="h-full w-full">
      <PreviewShell url="app.usevoltx.com/ai">
        <div className="flex h-full flex-col gap-3 p-4 sm:p-5">
          {/* user message */}
          <motion.div
            animate={{ opacity: step >= 0 ? 1 : 0, y: step >= 0 ? 0 : 8 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="self-end rounded-2xl rounded-br-md bg-primary/15 px-4 py-2.5 text-xs text-foreground/90 sm:text-sm"
          >
            Follow up with Meridian Labs about the proposal
          </motion.div>

          {/* agent block */}
          <div className="flex items-start gap-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Bot className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              {toolCalls.map((tool, index) => {
                const visible = step >= index + 1;
                const done = step > index + 1;
                return (
                  <motion.div
                    key={tool.label}
                    animate={{ opacity: visible ? 1 : 0, y: visible ? 0 : 6 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className={cn(
                      "flex items-center gap-2 self-start rounded-lg border px-3 py-1.5 font-mono text-[10px] sm:text-xs",
                      done
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-primary/25 bg-primary/10 text-primary",
                    )}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0" />
                    ) : (
                      <tool.icon className={cn("h-3 w-3 shrink-0", visible && "animate-pulse")} />
                    )}
                    <span className="truncate">{tool.label}</span>
                  </motion.div>
                );
              })}

              <motion.div
                animate={{ opacity: step >= 4 ? 1 : 0, y: step >= 4 ? 0 : 8 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="rounded-2xl rounded-tl-md border border-white/10 bg-white/[0.04] px-4 py-3"
              >
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" />
                  Draft ready
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                  Hi Dana — following up on the proposal we shared Tuesday. Based on your team&apos;s
                  notes, I&apos;ve attached the updated pricing for 40 seats&hellip;
                </p>
                <div className="mt-2.5 flex gap-2">
                  <span className="rounded-md bg-primary px-2.5 py-1 text-[10px] font-semibold text-primary-foreground">
                    Send
                  </span>
                  <span className="rounded-md border border-white/10 px-2.5 py-1 text-[10px] text-muted-foreground">
                    Edit
                  </span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </PreviewShell>
    </div>
  );
}
