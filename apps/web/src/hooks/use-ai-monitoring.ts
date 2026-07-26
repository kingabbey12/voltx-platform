import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  healthApi,
  platformHealthApi,
  alertsApi,
  knowledgeStatsApi,
  backgroundJobsApi,
  type CreateAlertInput,
  type AlertSeverity,
  type AlertStatus,
} from "@/lib/api/ai-monitoring";

// ─── Health ──────────────────────────────────────────────────────────────

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => healthApi.get(),
    refetchInterval: 30_000,
  });
}

export function usePlatformHealth() {
  return useQuery({
    queryKey: ["platform", "system-health"],
    queryFn: () => platformHealthApi.get(),
    refetchInterval: 30_000,
  });
}

// ─── Alerts / Incidents ──────────────────────────────────────────────────

export function useAlerts(query?: {
  status?: AlertStatus;
  severity?: AlertSeverity;
  category?: string;
}) {
  return useQuery({
    queryKey: ["platform", "alerts", query],
    queryFn: () => alertsApi.list(query),
    refetchInterval: 15_000,
  });
}

export function useAcknowledgeAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.acknowledge(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "alerts"] });
    },
  });
}

export function useResolveAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.resolve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "alerts"] });
    },
  });
}

export function useCreateAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAlertInput) => alertsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "alerts"] });
    },
  });
}

export function useDeleteAlert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => alertsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform", "alerts"] });
    },
  });
}

// ─── Knowledge Stats ─────────────────────────────────────────────────────

export function useKnowledgeStats() {
  return useQuery({
    queryKey: ["knowledge", "stats"],
    queryFn: () => knowledgeStatsApi.stats(),
    refetchInterval: 60_000,
  });
}

export function useKnowledgeHealth() {
  return useQuery({
    queryKey: ["knowledge", "health"],
    queryFn: () => knowledgeStatsApi.health(),
    refetchInterval: 30_000,
  });
}

// ─── Background Job Failures ─────────────────────────────────────────────

export function useBackgroundJobFailures() {
  return useQuery({
    queryKey: ["background-jobs", "dead-letters"],
    queryFn: () => backgroundJobsApi.deadLetters(),
    refetchInterval: 30_000,
  });
}
