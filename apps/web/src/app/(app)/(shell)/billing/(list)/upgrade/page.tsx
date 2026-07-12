"use client";

import { useState } from "react";
import { Check, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import {
  usePlans,
  useSubscription,
  useCreateCheckoutSession,
  useUpgradeSubscription,
  useDowngradeSubscription,
} from "@/hooks/use-billing";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import type { Plan } from "@/lib/api/billing";
import { featureLabel, formatFeatureQuantity } from "@/lib/billing-labels";
import { formatCurrency } from "@/lib/format";

export default function BillingUpgradePage() {
  const { data: plans, isLoading } = usePlans();
  const { data: subscription } = useSubscription();
  const [seats, setSeats] = useState(1);
  const [pendingPlanKey, setPendingPlanKey] = useState<string | null>(null);

  const createCheckoutSession = useCreateCheckoutSession();
  const upgradeSubscription = useUpgradeSubscription();
  const downgradeSubscription = useDowngradeSubscription();

  const currentPlan = plans?.find((p) => p.id === subscription?.planId);

  async function handleChoosePlan(plan: Plan) {
    if (!subscription) return;
    setPendingPlanKey(plan.key);

    try {
      if (!subscription.stripeSubscriptionId) {
        // No real Stripe subscription behind this trial yet — every plan
        // change has to go through Checkout first so a payment method is
        // actually collected.
        const session = await createCheckoutSession.mutateAsync({
          planKey: plan.key,
          seats,
          successUrl: `${window.location.origin}/billing?checkout=success`,
          cancelUrl: `${window.location.origin}/billing/upgrade?checkout=cancelled`,
        });
        window.location.href = session.url;
        return;
      }

      const isUpgrade = !currentPlan || plan.sortOrder > currentPlan.sortOrder;
      if (isUpgrade) {
        await upgradeSubscription.mutateAsync({ planKey: plan.key, seats });
      } else {
        await downgradeSubscription.mutateAsync({ planKey: plan.key, seats });
      }
      toast.success(`Switched to the ${plan.name} plan.`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    } finally {
      setPendingPlanKey(null);
    }
  }

  const mutationPending =
    createCheckoutSession.isPending || upgradeSubscription.isPending || downgradeSubscription.isPending;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Upgrade" description="Compare plans and pick the one that fits your team." />

      <Card>
        <CardContent className="flex items-center justify-between gap-4 pt-6">
          <div>
            <p className="text-sm font-medium">Seats</p>
            <p className="text-xs text-muted-foreground">
              How many teammates need access on the plan you choose below.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSeats((s) => Math.max(1, s - 1))}
              aria-label="Decrease seats"
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-6 text-center text-sm font-medium tabular-nums">{seats}</span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setSeats((s) => s + 1)}
              aria-label="Increase seats"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-secondary/60" />
          ))}
        </div>
      )}

      {!isLoading && plans && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => {
            const isCurrent = plan.id === subscription?.planId;
            return (
              <Card key={plan.id} className={isCurrent ? "border-primary" : undefined}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>{plan.name}</CardTitle>
                    {isCurrent && <Badge>Current plan</Badge>}
                  </div>
                  <CardDescription>
                    {plan.priceMonthlyUsd != null
                      ? `${formatCurrency(plan.priceMonthlyUsd)}/mo per seat`
                      : "Contact us"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                  {(plan.limits ?? []).slice(0, 6).map((limit) => (
                    <div key={limit.featureKey} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" />
                      <span>
                        {limit.limit === null ? "Unlimited" : formatFeatureQuantity(limit.limit, limit.unit)}{" "}
                        {featureLabel(limit.featureKey).toLowerCase()}
                      </span>
                    </div>
                  ))}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || plan.priceMonthlyUsd === null}
                    isLoading={mutationPending && pendingPlanKey === plan.key}
                    onClick={() => handleChoosePlan(plan)}
                  >
                    {isCurrent ? "Current plan" : plan.priceMonthlyUsd === null ? "Contact sales" : "Choose plan"}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
