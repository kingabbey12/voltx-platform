"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const STEP_LABELS = ["Welcome", "Account", "Business", "Connect", "Ready"];

/** 5-segment progress bar for the onboarding journey — Welcome and Create
 * Account (index 0-1) are always complete by the time this route is
 * reachable (they're the existing /register flow), so currentIndex is
 * always >= 2 here. Mirrors the mobile app's OnboardingProgressIndicator. */
export function OnboardingProgress({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="w-full">
      <div className="flex gap-1.5">
        {STEP_LABELS.map((_, i) => (
          <div key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <motion.div
              className={cn("h-full rounded-full", i <= currentIndex ? "bg-primary" : "bg-transparent")}
              initial={{ scaleX: i <= currentIndex ? 0 : 1 }}
              animate={{ scaleX: 1 }}
              style={{ transformOrigin: "left" }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs font-medium text-muted-foreground">
        Step {currentIndex + 1} of {STEP_LABELS.length} &bull; {STEP_LABELS[currentIndex]}
      </p>
    </div>
  );
}
