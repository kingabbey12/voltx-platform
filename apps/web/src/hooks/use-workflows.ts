import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  workflowSecretsApi,
  workflowTemplatesApi,
  workflowVariablesApi,
  workflowWebhooksApi,
  workflowsApi,
  type WorkflowDefinition,
  type WorkflowVariableType,
} from "@/lib/api/workflows";

export function useWorkflows(query: Parameters<typeof workflowsApi.list>[0] = {}) {
  return useQuery({ queryKey: ["workflows", query], queryFn: () => workflowsApi.list(query) });
}

export function useWorkflow(id: string) {
  return useQuery({ queryKey: ["workflows", id], queryFn: () => workflowsApi.get(id), enabled: !!id });
}

export function useWorkflowVersions(id: string) {
  return useQuery({
    queryKey: ["workflows", id, "versions"],
    queryFn: () => workflowsApi.listVersions(id),
    enabled: !!id,
  });
}

export function useWorkflowRuns(id: string) {
  return useQuery({
    queryKey: ["workflows", id, "runs"],
    queryFn: () => workflowsApi.listRuns(id),
    enabled: !!id,
    refetchInterval: 5_000,
  });
}

export function useWorkflowRun(runId: string) {
  return useQuery({
    queryKey: ["workflows", "runs", runId],
    queryFn: () => workflowsApi.getRun(runId),
    enabled: !!runId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      const terminal = status === "SUCCEEDED" || status === "FAILED" || status === "CANCELLED";
      return terminal ? false : 3_000;
    },
  });
}

export function useWorkflowRunLogs(runId: string) {
  return useQuery({
    queryKey: ["workflows", "runs", runId, "logs"],
    queryFn: () => workflowsApi.listRunLogs(runId),
    enabled: !!runId,
  });
}

export function useWorkflowRunCheckpoints(runId: string) {
  return useQuery({
    queryKey: ["workflows", "runs", runId, "checkpoints"],
    queryFn: () => workflowsApi.listRunCheckpoints(runId),
    enabled: !!runId,
  });
}

export function useWorkflowMetrics(id: string) {
  return useQuery({
    queryKey: ["workflows", id, "metrics"],
    queryFn: () => workflowsApi.metrics(id),
    enabled: !!id,
  });
}

export function useWorkflowHealth(id: string) {
  return useQuery({
    queryKey: ["workflows", id, "health"],
    queryFn: () => workflowsApi.health(id),
    enabled: !!id,
  });
}

export function useWorkflowDeadLetters() {
  return useQuery({
    queryKey: ["workflows", "dead-letters"],
    queryFn: () => workflowsApi.listDeadLetters(),
  });
}

export function useWorkflowSchedules(id: string) {
  return useQuery({
    queryKey: ["workflows", id, "schedules"],
    queryFn: () => workflowsApi.listSchedules(id),
    enabled: !!id,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; description?: string; definition: WorkflowDefinition }) =>
      workflowsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

export function useUpdateWorkflowDefinition(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (definition: WorkflowDefinition) => workflowsApi.update(id, { definition }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows", id] });
      queryClient.invalidateQueries({ queryKey: ["workflows", id, "versions"] });
    },
  });
}

export function usePublishWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowsApi.publish(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflows", id] });
    },
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
    mutationFn: (input?: Record<string, unknown>) => workflowsApi.run(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows", id, "runs"] }),
  });
}

function useRunAction(action: (runId: string) => ReturnType<typeof workflowsApi.pauseRun>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) => action(runId),
    onSuccess: (run, runId) => {
      queryClient.invalidateQueries({ queryKey: ["workflows", "runs", runId] });
      queryClient.invalidateQueries({ queryKey: ["workflows", run.workflowId, "runs"] });
    },
  });
}

export function usePauseRun() {
  return useRunAction(workflowsApi.pauseRun);
}
export function useResumeRun() {
  return useRunAction(workflowsApi.resumeRun);
}
export function useCancelRun() {
  return useRunAction(workflowsApi.cancelRun);
}
export function useRetryRun() {
  return useRunAction(workflowsApi.retryRun);
}

// --- Templates ---

export function useWorkflowTemplates(query: Parameters<typeof workflowTemplatesApi.list>[0] = {}) {
  return useQuery({
    queryKey: ["workflow-templates", query],
    queryFn: () => workflowTemplatesApi.list(query),
  });
}

export function useInstantiateWorkflowTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, name }: { key: string; name?: string }) =>
      workflowTemplatesApi.instantiate(key, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });
}

// --- Approvals ---

export function useWorkflowApprovals() {
  return useQuery({
    queryKey: ["workflow-approvals"],
    queryFn: () => workflowsApi.listApprovals(),
    refetchInterval: 15_000,
  });
}

export function useDecideWorkflowApproval() {
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
    }) => workflowsApi.decideApproval(approvalId, decision, comment),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-approvals"] }),
  });
}

// --- Secrets ---

export function useWorkflowSecrets() {
  return useQuery({ queryKey: ["workflow-secrets"], queryFn: () => workflowSecretsApi.list() });
}

export function useCreateWorkflowSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { key: string; value: string; description?: string }) =>
      workflowSecretsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-secrets"] }),
  });
}

export function useRotateWorkflowSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) =>
      workflowSecretsApi.rotate(id, value),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-secrets"] }),
  });
}

export function useDeleteWorkflowSecret() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowSecretsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-secrets"] }),
  });
}

// --- Webhooks ---

export function useWorkflowWebhooks(workflowId: string) {
  return useQuery({
    queryKey: ["workflows", workflowId, "webhooks"],
    queryFn: () => workflowWebhooksApi.list(workflowId),
    enabled: !!workflowId,
  });
}

export function useCreateWorkflowWebhook(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => workflowWebhooksApi.create(workflowId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflows", workflowId, "webhooks"] }),
  });
}

export function useSetWorkflowWebhookEnabled(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, enabled }: { webhookId: string; enabled: boolean }) =>
      workflowWebhooksApi.setEnabled(webhookId, enabled),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflows", workflowId, "webhooks"] }),
  });
}

export function useDeleteWorkflowWebhook(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => workflowWebhooksApi.delete(webhookId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflows", workflowId, "webhooks"] }),
  });
}

// --- Variables ---

export function useOrgWorkflowVariables() {
  return useQuery({
    queryKey: ["workflow-variables", "org"],
    queryFn: () => workflowVariablesApi.listOrg(),
  });
}

export function useWorkflowVariablesForWorkflow(workflowId: string) {
  return useQuery({
    queryKey: ["workflow-variables", workflowId],
    queryFn: () => workflowVariablesApi.listForWorkflow(workflowId),
    enabled: !!workflowId,
  });
}

export function useCreateOrgWorkflowVariable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      key: string;
      type?: WorkflowVariableType;
      defaultValue?: unknown;
      description?: string;
    }) => workflowVariablesApi.createOrg(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-variables"] }),
  });
}

export function useCreateWorkflowVariable(workflowId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      key: string;
      type?: WorkflowVariableType;
      defaultValue?: unknown;
      description?: string;
    }) => workflowVariablesApi.createForWorkflow(workflowId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["workflow-variables", workflowId] }),
  });
}

export function useUpdateWorkflowVariable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...input
    }: {
      id: string;
      type?: WorkflowVariableType;
      defaultValue?: unknown;
      description?: string;
    }) => workflowVariablesApi.update(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-variables"] }),
  });
}

export function useDeleteWorkflowVariable() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => workflowVariablesApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflow-variables"] }),
  });
}
