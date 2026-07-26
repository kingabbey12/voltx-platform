import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  agentsApi,
  type CreateAgentInput,
  type UpdateAgentInput,
  type RunAgentInput,
  type RunAutonomousInput,
} from "@/lib/api/agents";

export function useAgents(query: { page?: number; limit?: number; search?: string; enabled?: boolean } = {}) {
  return useQuery({
    queryKey: ["agents", query],
    queryFn: () => agentsApi.listAgents(query),
  });
}

export function useAgent(id: string | null) {
  return useQuery({
    queryKey: ["agents", id],
    queryFn: () => agentsApi.getAgent(id!),
    enabled: !!id,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAgentInput) => agentsApi.createAgent(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateAgentInput) =>
      agentsApi.updateAgent(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => agentsApi.deleteAgent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useAgentStats(agentId: string | null) {
  return useQuery({
    queryKey: ["agents", agentId, "stats"],
    queryFn: () => agentsApi.getAgentStats(agentId!),
    enabled: !!agentId,
  });
}

export function useRunAgent() {
  return useMutation({
    mutationFn: ({ agentId, input }: { agentId: string; input: RunAgentInput }) =>
      agentsApi.runAgent(agentId, input),
  });
}

export function useRunAutonomous() {
  return useMutation({
    mutationFn: ({ agentId, input }: { agentId: string; input: RunAutonomousInput }) =>
      agentsApi.runAutonomous(agentId, input),
  });
}

export function useRunTree(runId: string | null) {
  return useQuery({
    queryKey: ["agents", "runs", runId, "tree"],
    queryFn: () => agentsApi.getRunTree(runId!),
    enabled: !!runId,
  });
}
