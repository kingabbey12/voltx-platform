import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  billingApi,
  type ChangeSubscriptionPlanInput,
  type CreateCheckoutSessionInput,
  type PlanKey,
} from "@/lib/api/billing";

export function usePlans() {
  return useQuery({ queryKey: ["billing", "plans"], queryFn: () => billingApi.listPlans() });
}

export function usePlan(key: PlanKey | undefined) {
  return useQuery({
    queryKey: ["billing", "plans", key],
    queryFn: () => billingApi.getPlan(key as PlanKey),
    enabled: !!key,
  });
}

export function useSubscription() {
  return useQuery({
    queryKey: ["billing", "subscription"],
    queryFn: () => billingApi.getSubscription(),
  });
}

export function useUsage() {
  return useQuery({ queryKey: ["billing", "usage"], queryFn: () => billingApi.getUsage() });
}

export function useUsageHistory(featureKey?: string, limit?: number) {
  return useQuery({
    queryKey: ["billing", "usage", "history", featureKey, limit],
    queryFn: () => billingApi.getUsageHistory({ featureKey, limit }),
  });
}

export function useInvoices(page = 1, limit = 20) {
  return useQuery({
    queryKey: ["billing", "invoices", page, limit],
    queryFn: () => billingApi.listInvoices({ page, limit }),
  });
}

export function usePaymentMethods() {
  return useQuery({
    queryKey: ["billing", "payment-methods"],
    queryFn: () => billingApi.listPaymentMethods(),
  });
}

export function useCreateCheckoutSession() {
  return useMutation({
    mutationFn: (input: CreateCheckoutSessionInput) => billingApi.createCheckoutSession(input),
  });
}

export function useCreatePortalSession() {
  return useMutation({
    mutationFn: (returnUrl: string) => billingApi.createPortalSession(returnUrl),
  });
}

export function useUpgradeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeSubscriptionPlanInput) => billingApi.upgradeSubscription(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
    },
  });
}

export function useDowngradeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeSubscriptionPlanInput) => billingApi.downgradeSubscription(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] });
      queryClient.invalidateQueries({ queryKey: ["billing", "usage"] });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (atPeriodEnd: boolean = true) => billingApi.cancelSubscription(atPeriodEnd),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] }),
  });
}

export function useResumeSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => billingApi.resumeSubscription(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] }),
  });
}

export function useCreateSetupIntent() {
  return useMutation({ mutationFn: () => billingApi.createSetupIntent() });
}

export function useAttachPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      stripePaymentMethodId,
      makeDefault,
    }: {
      stripePaymentMethodId: string;
      makeDefault?: boolean;
    }) => billingApi.attachPaymentMethod(stripePaymentMethodId, makeDefault),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "payment-methods"] }),
  });
}

export function useSetDefaultPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.setDefaultPaymentMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "payment-methods"] }),
  });
}

export function useRemovePaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => billingApi.removePaymentMethod(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "payment-methods"] }),
  });
}

export function useRedeemPromotionCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => billingApi.redeemPromotionCode(code),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["billing", "subscription"] }),
  });
}
