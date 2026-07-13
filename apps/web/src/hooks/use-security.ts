import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateApiKeyInput,
  type UpdateSecurityPolicyInput,
  securityApi,
} from "@/lib/api/security";
import { useAuthStore } from "@/lib/stores/auth-store";

function useOrganizationId(): string | undefined {
  return useAuthStore((state) => state.user?.organizationId);
}

export function useSecurityPolicy() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["security", "policy", organizationId],
    queryFn: () => securityApi.getPolicy(organizationId!),
    enabled: !!organizationId,
  });
}

export function useUpdateSecurityPolicy() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateSecurityPolicyInput) => {
      if (!organizationId) throw new Error("No active organization");
      return securityApi.updatePolicy(organizationId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["security", "policy", organizationId] });
    },
  });
}

export function useSessions() {
  return useQuery({
    queryKey: ["security", "sessions"],
    queryFn: () => securityApi.listSessions(),
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => securityApi.revokeSession(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["security", "sessions"] });
    },
  });
}

export function useLoginHistory(params: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["security", "login-history", params],
    queryFn: () => securityApi.loginHistory(params),
  });
}

export function useTrustedDevices() {
  return useQuery({
    queryKey: ["security", "trusted-devices"],
    queryFn: () => securityApi.listTrustedDevices(),
  });
}

export function useRevokeTrustedDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => securityApi.revokeTrustedDevice(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["security", "trusted-devices"] });
    },
  });
}

export function useApiKeys() {
  return useQuery({
    queryKey: ["security", "api-keys"],
    queryFn: () => securityApi.listApiKeys(),
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiKeyInput) => securityApi.createApiKey(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["security", "api-keys"] });
    },
  });
}

export function useRevokeApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => securityApi.revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["security", "api-keys"] });
    },
  });
}

export function useSetupMfa() {
  return useMutation({ mutationFn: () => securityApi.setupMfa() });
}

export function useVerifyMfaSetup() {
  return useMutation({ mutationFn: (code: string) => securityApi.verifyMfaSetup(code) });
}

export function useDisableMfa() {
  return useMutation({ mutationFn: (code: string) => securityApi.disableMfa(code) });
}

export function useRegenerateBackupCodes() {
  return useMutation({ mutationFn: (code: string) => securityApi.regenerateBackupCodes(code) });
}
