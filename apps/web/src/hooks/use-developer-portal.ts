import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type CreateOAuthApplicationInput,
  type CreatePersonalAccessTokenInput,
  type CreateServiceAccountInput,
  type CreateWebhookEndpointInput,
  type UpdateOAuthApplicationInput,
  type UpdateWebhookEndpointInput,
  oauthApplicationsApi,
  openApiDocsApi,
  personalAccessTokensApi,
  serviceAccountsApi,
  webhookEndpointsApi,
} from "@/lib/api/developer-portal";
import { useAuthStore } from "@/lib/stores/auth-store";

function useOrganizationId(): string | undefined {
  return useAuthStore((state) => state.user?.organizationId);
}

// ---------------------------------------------------------------------------
// Personal Access Tokens
// ---------------------------------------------------------------------------

export function usePersonalAccessTokens() {
  return useQuery({
    queryKey: ["developer-portal", "personal-access-tokens"],
    queryFn: () => personalAccessTokensApi.list(),
  });
}

export function useCreatePersonalAccessToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePersonalAccessTokenInput) => personalAccessTokensApi.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["developer-portal", "personal-access-tokens"] });
    },
  });
}

export function useRevokePersonalAccessToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => personalAccessTokensApi.revoke(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["developer-portal", "personal-access-tokens"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Service Accounts
// ---------------------------------------------------------------------------

export function useServiceAccounts() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["developer-portal", "service-accounts", organizationId],
    queryFn: () => serviceAccountsApi.list(organizationId!),
    enabled: !!organizationId,
  });
}

export function useCreateServiceAccount() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateServiceAccountInput) => {
      if (!organizationId) throw new Error("No active organization");
      return serviceAccountsApi.create(organizationId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["developer-portal", "service-accounts", organizationId],
      });
    },
  });
}

export function useSetServiceAccountStatus() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "reactivate" }) => {
      if (!organizationId) throw new Error("No active organization");
      return action === "suspend"
        ? serviceAccountsApi.suspend(organizationId, id)
        : serviceAccountsApi.reactivate(organizationId, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["developer-portal", "service-accounts", organizationId],
      });
    },
  });
}

export function useServiceAccountTokens(serviceAccountId: string | null) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["developer-portal", "service-account-tokens", organizationId, serviceAccountId],
    queryFn: () => serviceAccountsApi.listTokens(organizationId!, serviceAccountId!),
    enabled: !!organizationId && !!serviceAccountId,
  });
}

export function useCreateServiceAccountToken() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      serviceAccountId,
      input,
    }: {
      serviceAccountId: string;
      input: { name: string; expiresAt?: string };
    }) => {
      if (!organizationId) throw new Error("No active organization");
      return serviceAccountsApi.createToken(organizationId, serviceAccountId, input);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          "developer-portal",
          "service-account-tokens",
          organizationId,
          variables.serviceAccountId,
        ],
      });
    },
  });
}

export function useRevokeServiceAccountToken() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceAccountId, tokenId }: { serviceAccountId: string; tokenId: string }) => {
      if (!organizationId) throw new Error("No active organization");
      return serviceAccountsApi.revokeToken(organizationId, serviceAccountId, tokenId);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: [
          "developer-portal",
          "service-account-tokens",
          organizationId,
          variables.serviceAccountId,
        ],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// OAuth Applications
// ---------------------------------------------------------------------------

export function useOAuthApplications() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["developer-portal", "oauth-applications", organizationId],
    queryFn: () => oauthApplicationsApi.list(organizationId!),
    enabled: !!organizationId,
  });
}

function useInvalidateOAuthApplications() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["developer-portal", "oauth-applications", organizationId] });
}

export function useCreateOAuthApplication() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateOAuthApplications();
  return useMutation({
    mutationFn: (input: CreateOAuthApplicationInput) => {
      if (!organizationId) throw new Error("No active organization");
      return oauthApplicationsApi.create(organizationId, input);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateOAuthApplication() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateOAuthApplications();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateOAuthApplicationInput }) => {
      if (!organizationId) throw new Error("No active organization");
      return oauthApplicationsApi.update(organizationId, id, input);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useRotateOAuthApplicationSecret() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No active organization");
      return oauthApplicationsApi.rotateSecret(organizationId, id);
    },
  });
}

export function useSetOAuthApplicationStatus() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateOAuthApplications();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "reactivate" }) => {
      if (!organizationId) throw new Error("No active organization");
      return action === "suspend"
        ? oauthApplicationsApi.suspend(organizationId, id)
        : oauthApplicationsApi.reactivate(organizationId, id);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteOAuthApplication() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateOAuthApplications();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No active organization");
      return oauthApplicationsApi.delete(organizationId, id);
    },
    onSuccess: () => void invalidate(),
  });
}

// ---------------------------------------------------------------------------
// Webhook Endpoints
// ---------------------------------------------------------------------------

export function useWebhookEndpoints() {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["developer-portal", "webhook-endpoints", organizationId],
    queryFn: () => webhookEndpointsApi.list(organizationId!),
    enabled: !!organizationId,
  });
}

export function useWebhookEndpoint(id: string | null) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["developer-portal", "webhook-endpoint", organizationId, id],
    queryFn: () => webhookEndpointsApi.get(organizationId!, id!),
    enabled: !!organizationId && !!id,
  });
}

function useInvalidateWebhookEndpoints() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: ["developer-portal", "webhook-endpoints", organizationId] });
}

export function useCreateWebhookEndpoint() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateWebhookEndpoints();
  return useMutation({
    mutationFn: (input: CreateWebhookEndpointInput) => {
      if (!organizationId) throw new Error("No active organization");
      return webhookEndpointsApi.create(organizationId, input);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateWebhookEndpoint() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateWebhookEndpoints();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateWebhookEndpointInput }) => {
      if (!organizationId) throw new Error("No active organization");
      return webhookEndpointsApi.update(organizationId, id, input);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useRotateWebhookEndpointSecret() {
  const organizationId = useOrganizationId();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No active organization");
      return webhookEndpointsApi.rotateSecret(organizationId, id);
    },
  });
}

export function useSetWebhookEndpointStatus() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateWebhookEndpoints();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "suspend" | "reactivate" }) => {
      if (!organizationId) throw new Error("No active organization");
      return action === "suspend"
        ? webhookEndpointsApi.suspend(organizationId, id)
        : webhookEndpointsApi.reactivate(organizationId, id);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useDeleteWebhookEndpoint() {
  const organizationId = useOrganizationId();
  const invalidate = useInvalidateWebhookEndpoints();
  return useMutation({
    mutationFn: (id: string) => {
      if (!organizationId) throw new Error("No active organization");
      return webhookEndpointsApi.delete(organizationId, id);
    },
    onSuccess: () => void invalidate(),
  });
}

export function useWebhookDeliveries(endpointId: string | null) {
  const organizationId = useOrganizationId();
  return useQuery({
    queryKey: ["developer-portal", "webhook-deliveries", organizationId, endpointId],
    queryFn: () => webhookEndpointsApi.listDeliveries(organizationId!, endpointId!),
    enabled: !!organizationId && !!endpointId,
    refetchInterval: 10_000,
  });
}

export function useReplayWebhookDelivery() {
  const organizationId = useOrganizationId();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ endpointId, deliveryId }: { endpointId: string; deliveryId: string }) => {
      if (!organizationId) throw new Error("No active organization");
      return webhookEndpointsApi.replayDelivery(organizationId, endpointId, deliveryId);
    },
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: ["developer-portal", "webhook-deliveries", organizationId, variables.endpointId],
      });
    },
  });
}

// ---------------------------------------------------------------------------
// OpenAPI document — shared by the API docs viewer and the playground.
// ---------------------------------------------------------------------------

export function useOpenApiDocument() {
  return useQuery({
    queryKey: ["developer-portal", "openapi-document"],
    queryFn: () => openApiDocsApi.fetchDocument(),
    staleTime: 5 * 60 * 1000,
  });
}
