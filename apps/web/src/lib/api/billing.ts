import { apiClient } from "./client";
import type { PaginatedResult } from "./types";

export type PlanKey = "free" | "starter" | "professional" | "business" | "enterprise";

export interface PlanFeatureLimit {
  featureKey: string;
  unit: string;
  limit: number | null;
  softLimitPercent: number | null;
}

export interface Plan {
  id: string;
  key: PlanKey;
  name: string;
  description: string | null;
  priceMonthlyUsd: number | null;
  priceYearlyUsd: number | null;
  sortOrder: number;
  trialDays: number;
  limits?: PlanFeatureLimit[];
}

export type SubscriptionStatus =
  | "TRIALING"
  | "ACTIVE"
  | "PAST_DUE"
  | "CANCELED"
  | "INCOMPLETE"
  | "UNPAID"
  | "PAUSED";

export interface Subscription {
  id: string;
  planId: string;
  stripeSubscriptionId: string | null;
  status: SubscriptionStatus;
  seats: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  trialStart: string | null;
  trialEnd: string | null;
  cancelAtPeriodEnd: boolean;
  canceledAt: string | null;
}

export interface FeatureUsage {
  featureKey: string;
  currentUsage: number;
  /** null = unlimited on this plan. */
  limit: number | null;
  remaining: number | null;
  unit: string;
}

export interface UsageSnapshot {
  featureKey: string;
  periodStart: string;
  periodEnd: string;
  totalQuantity: number;
}

export type InvoiceStatus = "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";

export interface Invoice {
  id: string;
  stripeInvoiceId: string | null;
  status: InvoiceStatus;
  amountDue: number;
  amountPaid: number;
  amountRemaining: number;
  currency: string;
  dueDate: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
}

export type PaymentMethodType = "CARD" | "BANK" | "OTHER";

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  brand: string | null;
  last4: string | null;
  expMonth: number | null;
  expYear: number | null;
  isDefault: boolean;
}

export interface CreateCheckoutSessionInput {
  planKey: PlanKey;
  seats?: number;
  successUrl: string;
  cancelUrl: string;
}

export interface ChangeSubscriptionPlanInput {
  planKey: PlanKey;
  seats?: number;
}

export const billingApi = {
  listPlans: () => apiClient.get<Plan[]>("/billing/plans"),
  getPlan: (key: PlanKey) => apiClient.get<Plan>(`/billing/plans/${key}`),

  getSubscription: () => apiClient.get<Subscription>("/billing/subscription"),
  upgradeSubscription: (input: ChangeSubscriptionPlanInput) =>
    apiClient.post<Subscription>("/billing/subscription/upgrade", input),
  downgradeSubscription: (input: ChangeSubscriptionPlanInput) =>
    apiClient.post<Subscription>("/billing/subscription/downgrade", input),
  cancelSubscription: (atPeriodEnd = true) =>
    apiClient.post<Subscription>("/billing/subscription/cancel", { atPeriodEnd }),
  resumeSubscription: () => apiClient.post<Subscription>("/billing/subscription/resume"),

  getUsage: () => apiClient.get<FeatureUsage[]>("/billing/usage"),
  getUsageHistory: (params: { featureKey?: string; limit?: number } = {}) =>
    apiClient.get<UsageSnapshot[]>("/billing/usage/history", { query: params }),

  createCheckoutSession: (input: CreateCheckoutSessionInput) =>
    apiClient.post<{ id: string; url: string }>("/billing/checkout", input),
  createPortalSession: (returnUrl: string) =>
    apiClient.post<{ id: string; url: string }>("/billing/portal", { returnUrl }),

  listInvoices: (params: { page?: number; limit?: number } = {}) =>
    apiClient.get<PaginatedResult<Invoice>>("/billing/invoices", { query: params }),

  listPaymentMethods: () => apiClient.get<PaymentMethod[]>("/billing/payment-methods"),
  createSetupIntent: () =>
    apiClient.post<{ clientSecret: string }>("/billing/payment-methods/setup-intent"),
  attachPaymentMethod: (stripePaymentMethodId: string, makeDefault = false) =>
    apiClient.post<PaymentMethod>("/billing/payment-methods", {
      stripePaymentMethodId,
      makeDefault,
    }),
  setDefaultPaymentMethod: (id: string) =>
    apiClient.post<PaymentMethod>(`/billing/payment-methods/${id}/default`),
  removePaymentMethod: (id: string) =>
    apiClient.delete<{ removed: true }>(`/billing/payment-methods/${id}`),

  redeemPromotionCode: (code: string) =>
    apiClient.post<{ redeemed: true }>("/billing/coupons/redeem", { code }),
};
