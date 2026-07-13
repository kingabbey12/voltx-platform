"use client";

import { CheckCircle2, CircleDashed, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConnectStatus, useCreateOnboardingLink } from "@/hooks/use-marketplace";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const STATUS_COPY: Record<string, string> = {
  PENDING: "You haven't started onboarding with Stripe yet.",
  ONBOARDING: "Your Stripe Connect onboarding is in progress.",
  COMPLETE: "Onboarding complete. You can receive payouts on paid app installs.",
};

const STATUS_VARIANT: Record<string, "default" | "warning" | "success"> = {
  PENDING: "default",
  ONBOARDING: "warning",
  COMPLETE: "success",
};

export default function PayoutsPage() {
  const { data: status, isLoading } = useConnectStatus();
  const createLink = useCreateOnboardingLink();

  async function onStartOnboarding() {
    try {
      const result = await createLink.mutateAsync();
      window.location.href = result.url;
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Developer Payouts</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Connect a Stripe account to receive your share of revenue from paid app installs. Voltx
        takes a platform fee on each purchase; the rest is paid out directly to your account.
      </p>

      <Card className="mt-6 p-6">
        {isLoading ? (
          <div className="h-16 animate-pulse rounded-lg bg-secondary/60" />
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              {status?.onboardingStatus === "COMPLETE" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" />
              ) : (
                <CircleDashed className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">Stripe Connect</span>
                  <Badge variant={STATUS_VARIANT[status?.onboardingStatus ?? "PENDING"]}>
                    {status?.onboardingStatus ?? "PENDING"}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {STATUS_COPY[status?.onboardingStatus ?? "PENDING"]}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Payouts {status?.payoutsEnabled ? "enabled" : "not yet enabled"}
                </p>
              </div>
            </div>
            <Button onClick={onStartOnboarding} isLoading={createLink.isPending}>
              {status?.onboardingStatus === "COMPLETE" ? "Manage account" : "Start onboarding"}
              <ExternalLink className="h-4 w-4" />
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
