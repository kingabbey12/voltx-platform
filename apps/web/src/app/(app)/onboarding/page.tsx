"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { BrandMark } from "@/components/brand-mark";
import { OnboardingProgress } from "@/components/onboarding/onboarding-progress";
import { BusinessInfoStep } from "@/components/onboarding/business-info-step";
import { ConnectAppsStep } from "@/components/onboarding/connect-apps-step";
import { CompleteStep } from "@/components/onboarding/complete-step";
import { cn } from "@/lib/utils";

type Step = "business-info" | "connect-apps" | "complete";

const STEP_INDEX: Record<Step, number> = {
  "business-info": 2,
  "connect-apps": 3,
  complete: 4,
};

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("business-info");

  return (
    <div className="relative flex min-h-svh flex-col items-center bg-background px-4 py-12">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
      >
        <div className="absolute left-1/2 top-[-10%] h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
      </div>

      <div className="mb-8 flex items-center gap-2.5">
        <BrandMark />
        <span className="text-lg font-semibold tracking-tight">Voltx</span>
      </div>

      <div className={cn("w-full transition-[max-width] duration-300", step === "business-info" ? "max-w-2xl" : "max-w-[440px]")}>
        <OnboardingProgress currentIndex={STEP_INDEX[step]} />

        <div className="mt-8 rounded-2xl border border-border bg-card p-8 shadow-lg sm:p-10">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              {step === "business-info" && (
                <BusinessInfoStep onNext={() => setStep("connect-apps")} />
              )}
              {step === "connect-apps" && <ConnectAppsStep onNext={() => setStep("complete")} />}
              {step === "complete" && (
                <CompleteStep onFinished={() => router.replace("/dashboard")} />
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
