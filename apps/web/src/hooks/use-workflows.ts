import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { workflowsApi, type WorkflowDefinition } from "@/lib/api/workflows";

export function useWorkflows(query: Parameters<typeof workflowsApi.list>[0] = {}) {
  return useQuery({ queryKey: ["workflows", query], queryFn: () => workflowsApi.list(query) });
}

export function useWorkflow(id: string) {
  return useQuery({ queryKey: ["workflows", id], queryFn: () => workflowsApi.get(id) });
}

export function useWorkflowRuns(id: string) {
  return useQuery({ queryKey: ["workflows", id, "runs"], queryFn: () => workflowsApi.listRuns(id) });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; definition: WorkflowDefinition }) =>
      workflowsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function usePublishWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowsApi.publish(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useArchiveWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowsApi.archive(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useRunWorkflow(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => workflowsApi.run(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows", id, "runs"] }),
  });
}
