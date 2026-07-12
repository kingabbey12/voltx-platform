import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import {
  platformApi,
  type SearchPlatformOrganizationsParams,
} from "@/lib/api/platform";
import { tokenStorage } from "@/lib/api/token-storage";
import { useAuthStore } from "@/lib/stores/auth-store";
import { useImpersonationStore } from "@/lib/stores/impersonation-store";

export function usePlatformOrganizations(params: SearchPlatformOrganizationsParams) {
  return useQuery({
    queryKey: ["platform", "organizations", params],
    queryFn: () => platformApi.searchOrganizations(params),
  });
}

export function usePlatformRevenueSummary() {
  return useQuery({
    queryKey: ["platform", "revenue-summary"],
    queryFn: () => platformApi.getRevenueSummary(),
  });
}

export function usePlatformSystemHealth() {
  return useQuery({
    queryKey: ["platform", "system-health"],
    queryFn: () => platformApi.getSystemHealth(),
    refetchInterval: 30_000,
  });
}

export function useOrgHealthScore(organizationId: string | null) {
  return useQuery({
    queryKey: ["platform", "org-health-score", organizationId],
    queryFn: () => platformApi.getOrgHealthScore(organizationId!),
    enabled: !!organizationId,
  });
}

export function useSupportSessions() {
  return useQuery({
    queryKey: ["platform", "support-sessions"],
    queryFn: () => platformApi.listSupportSessions(),
  });
}

/** Starts impersonation: swaps the stored access token, refreshes the
 * resolved `me()` profile under the new (target-org) context, and
 * records the session in the impersonation store so the banner renders. */
export function useStartImpersonation() {
  const setUser = useAuthStore((state) => state.setUser);
  const setImpersonationInfo = useImpersonationStore((state) => state.setInfo);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      targetOrganizationId: string;
      organizationName: string;
      reason: string;
    }) => {
      const result = await platformApi.startSupportSession({
        targetOrganizationId: input.targetOrganizationId,
        reason: input.reason,
      });
      tokenStorage.beginImpersonation(result.accessToken, {
        sessionId: result.session.id,
        organizationId: input.targetOrganizationId,
        organizationName: input.organizationName,
      });
      const user = await authApi.me();
      setUser(user);
      setImpersonationInfo({
        sessionId: result.session.id,
        organizationId: input.targetOrganizationId,
        organizationName: input.organizationName,
      });
      return result;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}

/** Ends impersonation early: revokes the session server-side, restores
 * the platform admin's own tokens, and refreshes `me()` back to their
 * real context. */
export function useEndImpersonation() {
  const setUser = useAuthStore((state) => state.setUser);
  const setImpersonationInfo = useImpersonationStore((state) => state.setInfo);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      await platformApi.endSupportSession(sessionId);
      tokenStorage.endImpersonation();
      const user = await authApi.me();
      setUser(user);
      setImpersonationInfo(null);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
