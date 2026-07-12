export class SubscriptionStatusBreakdownDto {
  status!: string;
  count!: number;
}

export class PlatformRevenueSummaryDto {
  /**
   * Approximated as sum(plan.priceMonthlyUsd * seats) across ACTIVE
   * subscriptions. Subscription/Plan track no monthly-vs-yearly billing
   * interval at the DB level (that distinction lives only in Stripe price
   * IDs) — see PlatformRevenueService for the full caveat.
   */
  estimatedMonthlyRecurringRevenueUsd!: number;
  totalRevenueCollectedUsd!: number;
  outstandingAmountDueUsd!: number;
  subscriptionsByStatus!: SubscriptionStatusBreakdownDto[];
}

export class PlatformOrganizationRevenueDto {
  organizationId!: string;
  subscriptionStatus!: string | null;
  planName!: string | null;
  seats!: number | null;
  currentPeriodEnd!: string | null;
  totalPaidUsd!: number;
  totalOutstandingUsd!: number;
  recentInvoices!: {
    id: string;
    status: string;
    amountDue: number;
    amountPaid: number;
    createdAt: string;
  }[];
}
