import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiDashboardApi } from "@/lib/api/ai-dashboard";
import { agentsApi } from "@/lib/api/agents";

export function useAiActivity(query: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["ai", "dashboard", "activity", query],
    queryFn: () => aiDashboardApi.getActivity(query),
  });
}

export function useAiPerformance(lookbackDays = 30) {
  return useQuery({
    queryKey: ["ai", "dashboard", "performance", lookbackDays],
    queryFn: () => aiDashboardApi.getPerformance(lookbackDays),
  });
}

export function useAiTasks() {
  return useQuery({
    queryKey: ["ai", "dashboard", "tasks"],
    queryFn: () => aiDashboardApi.getTasks(),
    refetchInterval: 15_000,
  });
}

export function useAiSuggestions() {
  return useQuery({
    queryKey: ["ai", "dashboard", "suggestions"],
    queryFn: () => aiDashboardApi.getSuggestions(),
  });
}

export function useDismissSuggestion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiDashboardApi.dismissSuggestion(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "dashboard", "suggestions"] });
    },
  });
}

export function useDecideApproval() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      approvalId,
      decision,
      comment,
    }: {
      approvalId: string;
      decision: "APPROVED" | "REJECTED";
      comment?: string;
    }) => agentsApi.decideApproval(approvalId, decision, comment),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "dashboard", "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["ai", "dashboard", "activity"] });
    },
  });
}
