import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { organizationsApi, type UpdateOrganizationInput } from "@/lib/api/organizations";
import { integrationsApi } from "@/lib/api/integrations";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useOrganizationProfile() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  return useQuery({
    queryKey: ["organization", organizationId],
    queryFn: () => organizationsApi.get(organizationId!),
    enabled: !!organizationId,
  });
}

export function useUpdateBusinessInfo() {
  const queryClient = useQueryClient();
  const organizationId = useAuthStore((state) => state.user?.organizationId);

  return useMutation({
    mutationFn: (input: UpdateOrganizationInput) => {
      if (!organizationId) throw new Error("No active organization");
      return organizationsApi.update(organizationId, input);
    },
    onSuccess: (profile) => {
      queryClient.setQueryData(["organization", organizationId], profile);
    },
  });
}

export function useCompleteOnboarding() {
  const organizationId = useAuthStore((state) => state.user?.organizationId);
  const setUser = useAuthStore((state) => state.setUser);
  const user = useAuthStore((state) => state.user);

  return useMutation({
    mutationFn: () => {
      if (!organizationId) throw new Error("No active organization");
      return organizationsApi.completeOnboarding(organizationId);
    },
    onSuccess: () => {
      if (user) {
        setUser({ ...user, onboardingCompleted: true });
      }
    },
  });
}

/** Real, live connection status for the onboarding "Connect Apps" step —
 * never mock data. Every OAuth provider here (Gmail, Outlook, Slack, Drive)
 * requires real OAuth client credentials the backend doesn't have
 * configured yet (empty clientId/clientSecret), so this only ever reads
 * existing connection status — it doesn't attempt to initiate a doomed
 * OAuth flow that would fail at the provider with "invalid client". */
export function useConnectedApps() {
  return useQuery({
    queryKey: ["integrations", "connections", "onboarding"],
    queryFn: () => integrationsApi.list({ limit: 50 }),
    select: (result) => new Set(result.items.filter((c) => c.status === "CONNECTED").map((c) => c.provider)),
  });
}
