"use client";

import Link from "next/link";
import { useState } from "react";
import { CreditCard, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { usePlans, useSubscription, useUsage, useCreatePortalSession, useResumeSubscription } from "@/hooks/use-billing";
import type { SubscriptionStatus } from "@/lib/api/billing";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { featureLabel, formatFeatureQuantity } from "@/lib/billing-labels";
import { formatCurrency, formatDate } from "@/lib/format";

const STATUS_VARIANT: Record<SubscriptionStatus, "success" | "warning" | "destructive" | "secondary"> = {
  TRIALING: "warning",
  ACTIVE: "success",
  PAST_DUE: "destructive",
  CANCELED: "destructive",
  INCOMPLETE: "secondary",
  UNPAID: "destructive",
  PAUSED: "secondary",
};

export default function BillingDashboardPage() {
  const { data: subscription, isLoading: subscriptionLoading } = useSubscription();
  const { data: plans } = usePlans();
  const { data: usage, isLoading: usageLoading } = useUsage();
  const createPortalSession = useCreatePortalSession();
  const resumeSubscription = useResumeSubscription();
  const [portalLoading, setPortalLoading] = useState(false);

  const plan = plans?.find((p) => p.id === subscription?.planId);

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const session = await createPortalSession.mutateAsync(
        `${window.location.origin}/billing`,
      );
      window.location.href = session.url;
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
      setPortalLoading(false);
    }
  }

  async function handleResume() {
    try {
      await resumeSubscription.mutateAsync();
      toast.success("Subscription resumed — it will keep renewing automatically.");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Billing"
        description="Your plan, usage, and payment details."
        action={
          <Button variant="outline" onClick={handleManageBilling} isLoading={portalLoading}>
            <CreditCard className="h-4 w-4" />
            Manage in Stripe
          </Button>
        }
      />

      {subscriptionLoading && (
        <div className="h-32 animate-pulse rounded-xl bg-secondary/60" />
      )}

      {!subscriptionLoading && subscription && (
        <>
          {subscription.cancelAtPeriodEnd && (
            <Card className="border-warning/40 bg-warning/5">
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <p className="text-sm font-medium">
                    Your subscription will end on {formatDate(subscription.currentPeriodEnd)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    You can resume it any time before then to keep your current plan.
                  </p>
                </div>
                <Button size="sm" onClick={handleResume} isLoading={resumeSubscription.isPending}>
                  Resume subscription
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
              <div>
                <CardTitle>{plan?.name ?? "Current plan"}</CardTitle>
                <CardDescription>
                  {plan?.priceMonthlyUsd != null
                    ? `${formatCurrency(plan.priceMonthlyUsd)}/month · ${subscription.seats} seat${subscription.seats === 1 ? "" : "s"}`
                    : `${subscription.seats} seat${subscription.seats === 1 ? "" : "s"}`}
                </CardDescription>
              </div>
              <Badge variant={STATUS_VARIANT[subscription.status]}>{subscription.status}</Badge>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {subscription.status === "TRIALING" && subscription.trialEnd && (
                <p className="text-sm text-muted-foreground">
                  Trial ends {formatDate(subscription.trialEnd)}.
                </p>
              )}
              <Link href="/billing/upgrade">
                <Button variant="secondary" size="sm">
                  <Sparkles className="h-4 w-4" />
                  Compare plans
                </Button>
              </Link>
            </CardContent>
          </Card>
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Usage this period</CardTitle>
          <CardDescription>Where your organization stands against its plan limits.</CardDescription>
        </CardHeader>
        <CardContent>
          {usageLoading && (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!usageLoading && usage && usage.length > 0 && (
            <div className="flex flex-col gap-4">
              {usage.map((row) => {
                const percent =
                  row.limit === null || row.limit === 0
                    ? 0
                    : Math.min(100, Math.round((row.currentUsage / row.limit) * 100));
                const nearLimit = row.limit !== null && percent >= 80;
                return (
                  <div key={row.featureKey} className="flex flex-col gap-1.5">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-medium">{featureLabel(row.featureKey)}</span>
                      <span className="text-muted-foreground">
                        {formatFeatureQuantity(row.currentUsage, row.unit)}
                        {row.limit !== null
                          ? ` / ${formatFeatureQuantity(row.limit, row.unit)}`
                          : " · Unlimited"}
                      </span>
                    </div>
                    {row.limit !== null && (
                      <Progress
                        value={percent}
                        indicatorClassName={nearLimit ? "bg-warning" : undefined}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
