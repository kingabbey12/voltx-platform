import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/auth";
import { tokenStorage } from "@/lib/api/token-storage";
import { useAuthStore } from "@/lib/stores/auth-store";

export function useMyOrganizations() {
  const status = useAuthStore((state) => state.status);
  return useQuery({
    queryKey: ["my-organizations"],
    queryFn: () => authApi.myOrganizations(),
    enabled: status === "authenticated",
  });
}

export function useSwitchOrganization() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);

  return useMutation({
    mutationFn: async (organizationId: string) => {
      const result = await authApi.switchOrganization(organizationId);
      tokenStorage.save({ accessToken: result.accessToken, refreshToken: result.refreshToken });
      return authApi.me();
    },
    onSuccess: (user) => {
      setUser(user);
      // Every org-scoped query is now stale — clear the slate rather than
      // enumerating each query key individually.
      queryClient.clear();
    },
  });
}
