"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useCompleteOnboarding, useConnectedApps } from "@/hooks/use-onboarding";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export function CompleteStep({ onFinished }: { onFinished: () => void }) {
  const user = useAuthStore((state) => state.user);
  const completeOnboarding = useCompleteOnboarding();
  const { data: connected } = useConnectedApps();
  const hasFinished = useRef(false);

  async function finish() {
    if (hasFinished.current) return;
    try {
      await completeOnboarding.mutateAsync();
      hasFinished.current = true;
      onFinished();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  useEffect(() => {
    const timer = setTimeout(finish, 1400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center text-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="flex h-20 w-20 items-center justify-center rounded-full bg-success/15"
      >
        <CheckCircle2 className="h-10 w-10 text-success" />
      </motion.div>

      <h1 className="mt-6 text-2xl font-semibold tracking-tight">You&apos;re all set</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">
        {user ? `${user.firstName}, your` : "Your"} AI workspace is ready to go.
      </p>

      <div className="mt-8 flex w-full items-center justify-evenly rounded-xl border border-border bg-card px-6 py-4">
        <div>
          <p className="text-xl font-semibold">{connected?.size ?? 0}</p>
          <p className="text-xs text-muted-foreground">Connected apps</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-xl font-semibold">1</p>
          <p className="text-xs text-muted-foreground">AI agent ready</p>
        </div>
      </div>

      <Button size="lg" className="mt-8 w-full" isLoading={completeOnboarding.isPending} onClick={finish}>
        Go to Dashboard
      </Button>
    </div>
  );
}
