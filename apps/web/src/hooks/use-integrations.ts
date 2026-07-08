import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { integrationsApi, type IntegrationPageQuery } from "@/lib/api/integrations";

export function useIntegrations(query: IntegrationPageQuery = {}) {
  return useQuery({ queryKey: ["integrations", query], queryFn: () => integrationsApi.list(query) });
}

export function useCreateApiKeyConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: integrationsApi.createApiKeyConnection,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useHealthCheckConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.healthCheck(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useSyncConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.sync(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}

export function useDeleteConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => integrationsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["integrations"] }),
  });
}
