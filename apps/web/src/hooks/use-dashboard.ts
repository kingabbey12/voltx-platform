import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "@/lib/api/dashboard";

/**
 * The dashboard's single data dependency.
 *
 * One request replaces the four parallel CRUD calls the KPI row used to make —
 * companies, leads, opportunities and conversations — plus the client-side
 * arithmetic that turned them into a pipeline figure. The aggregation now
 * happens in SQL, so this is both fewer round trips and a correct number.
 *
 * Every dashboard section reads from this one query, which means they share a
 * cache entry and a loading state instead of resolving at four different
 * moments and making the page shuffle as it settles.
 */
export function useDashboardMetrics(days = 30) {
  return useQuery({
    queryKey: ["dashboard", "metrics", days],
    queryFn: () => dashboardApi.getMetrics(days),
    // Aggregates move on a daily cadence, not per-request. A short stale window
    // keeps navigation back to the dashboard instant without serving figures
    // old enough to mislead.
    staleTime: 60_000,
  });
}

export function useExecutiveBrief() {
  return useQuery({
    queryKey: ["dashboard", "brief"],
    queryFn: () => dashboardApi.getBrief(),
    staleTime: 30_000,
  });
}

export function useDashboardRecommendations() {
  return useQuery({
    queryKey: ["dashboard", "recommendations"],
    queryFn: () => dashboardApi.getRecommendations(),
    staleTime: 30_000,
  });
}

function useRefreshDashboard() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["dashboard", "recommendations"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "brief"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard", "metrics"] });
  };
}

export function useApproveRecommendation() {
  const refresh = useRefreshDashboard();
  return useMutation({
    mutationFn: dashboardApi.approveRecommendation,
    onSuccess: refresh,
  });
}

export function useDismissRecommendation() {
  const refresh = useRefreshDashboard();
  return useMutation({
    mutationFn: dashboardApi.dismissRecommendation,
    onSuccess: refresh,
  });
}

export function useExecuteRecommendationAction() {
  const refresh = useRefreshDashboard();
  return useMutation({
    mutationFn: ({ recommendationId, actionId }: { recommendationId: string; actionId: string }) =>
      dashboardApi.executeRecommendationAction(recommendationId, actionId),
    onSuccess: refresh,
  });
}
