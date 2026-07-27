import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aiCredentialsApi,
  aiSettingsApi,
  type AiSettings,
  type CreateAiCredentialInput,
  type UpdateAiCredentialInput,
  type RotateAiCredentialInput,
} from "@/lib/api/ai-settings";
import { useAuthStore } from "@/lib/stores/auth-store";

// ─── Credentials ─────────────────────────────────────────────────────────

export function useAiCredentials() {
  return useQuery({
    queryKey: ["ai", "credentials"],
    queryFn: () => aiCredentialsApi.list(),
  });
}

export function useCreateAiCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAiCredentialInput) =>
      aiCredentialsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "credentials"] });
    },
  });
}

export function useUpdateAiCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateAiCredentialInput) =>
      aiCredentialsApi.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "credentials"] });
    },
  });
}

export function useRotateAiCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & RotateAiCredentialInput) =>
      aiCredentialsApi.rotate(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "credentials"] });
    },
  });
}

export function useTestAiCredential() {
  return useMutation({
    mutationFn: (id: string) => aiCredentialsApi.test(id),
  });
}

export function useDeleteAiCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiCredentialsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "credentials"] });
    },
  });
}

// ─── AI Settings (org.settings.ai) ───────────────────────────────────────

function useOrganizationId(): string | null {
  return useAuthStore((s) => s.user?.organizationId ?? null);
}

export function useAiSettings() {
  const orgId = useOrganizationId();
  return useQuery({
    queryKey: ["ai", "settings"],
    queryFn: () => aiSettingsApi.get(orgId!),
    enabled: !!orgId,
  });
}

export function useUpdateAiSettings() {
  const orgId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (partial: Partial<AiSettings>) =>
      aiSettingsApi.update(orgId!, partial),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "settings"] });
    },
  });
}
