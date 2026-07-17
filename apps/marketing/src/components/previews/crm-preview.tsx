"use client";

import { motion } from "framer-motion";
import { Building2, DollarSign } from "lucide-react";
import { PreviewShell, useLoopStep } from "@/components/previews/preview-shell";
import { cn } from "@/lib/utils";

const stages = ["Qualified", "Proposal", "Closed Won"] as const;

const staticDeals: Record<number, { name: string; amount: string }[]> = {
  0: [
    { name: "Northwind Retail", amount: "$18k" },
    { name: "Atlas Freight", amount: "$32k" },
  ],
  1: [{ name: "Helio Energy", amount: "$54k" }],
  2: [{ name: "Corvid Media", amount: "$21k" }],
};

/**
 * A pipeline board where one deal — Meridian Labs — advances a stage per
 * step and lands in Closed Won. The moving card is a shared layout
 * element, so the move is a real animated transit rather than a
 * disappear/reappear.
 */
export function CrmPreview() {
  const { ref, step } = useLoopStep(4, 1800);
  // Steps 0..2 place the live deal in each stage; step 3 holds on Won.
  const liveDealStage = Math.min(step, 2);

  return (
    <div ref={ref} className="h-full w-full">
      <PreviewShell url="app.usevoltx.com/crm">
        <div className="grid h-full grid-cols-3 gap-2.5 p-3 sm:gap-3 sm:p-4">
          {stages.map((stage, stageIndex) => (
            <div key={stage} className="flex min-h-0 flex-col rounded-xl bg-white/[0.03] p-2 sm:p-2.5">
              <div className="flex items-center justify-between px-1 pb-2">
                <span
                  className={cn(
                    "text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]",
                    stageIndex === 2 ? "text-success" : "text-muted-foreground",
                  )}
                >
                  {stage}
                </span>
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    stageIndex === 0 && "bg-info",
                    stageIndex === 1 && "bg-warning",
                    stageIndex === 2 && "bg-success",
                  )}
                />
              </div>

              <div className="flex flex-col gap-2">
                {staticDeals[stageIndex]?.map((deal) => (
                  <DealCard key={deal.name} name={deal.name} amount={deal.amount} />
                ))}

                {liveDealStage === stageIndex ? (
                  <motion.div
                    layoutId="crm-live-deal"
                    transition={{ type: "spring", stiffness: 320, damping: 32 }}
                  >
                    <DealCard
                      name="Meridian Labs"
                      amount="$86k"
                      highlight
                      won={liveDealStage === 2}
                    />
                  </motion.div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </PreviewShell>
    </div>
  );
}

function DealCard({
  name,
  amount,
  highlight = false,
  won = false,
}: {
  name: string;
  amount: string;
  highlight?: boolean;
  won?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-2 sm:p-2.5",
        highlight
          ? won
            ? "border-success/40 bg-success/10 shadow-[0_0_24px_-6px_hsl(var(--success)/0.5)]"
            : "border-primary/40 bg-primary/10 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)]"
          : "border-white/8 bg-card/80",
      )}
    >
      <div className="flex items-center gap-1.5">
        <Building2
          className={cn(
            "h-3 w-3 shrink-0",
            highlight ? (won ? "text-success" : "text-primary") : "text-muted-foreground",
          )}
        />
        <span className="truncate text-[10px] font-medium text-foreground/90 sm:text-xs">
          {name}
        </span>
      </div>
      <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-muted-foreground sm:text-xs">
        <DollarSign className="h-2.5 w-2.5" />
        {amount.replace("$", "")}
      </div>
    </div>
  );
}
