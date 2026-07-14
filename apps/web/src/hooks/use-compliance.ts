import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type ConsentHistoryQuery,
  type CreateAuditExportInput,
  type CreateConsentRecordInput,
  type CreateLegalHoldInput,
  type CreateRetentionPolicyInput,
  type UpdateLegalHoldInput,
  type UpdateRetentionPolicyInput,
  complianceApi,
} from "@/lib/api/compliance";

export function useConsentRecords(query: ConsentHistoryQuery = {}) {
  return useQuery({
    queryKey: ["compliance", "consent-records", query],
    queryFn: () => complianceApi.listConsentRecords(query),
  });
}

export function useCreateConsentRecord() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateConsentRecordInput) => complianceApi.createConsentRecord(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "consent-records"] });
    },
  });
}

export function useExportUserData() {
  return useMutation({ mutationFn: (userId: string) => complianceApi.exportUserData(userId) });
}

export function useDeleteUserData() {
  return useMutation({ mutationFn: (userId: string) => complianceApi.deleteUserData(userId) });
}

export function useLegalHolds() {
  return useQuery({
    queryKey: ["compliance", "legal-holds"],
    queryFn: () => complianceApi.listLegalHolds(),
  });
}

export function useCreateLegalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateLegalHoldInput) => complianceApi.createLegalHold(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "legal-holds"] });
    },
  });
}

export function useUpdateLegalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLegalHoldInput }) =>
      complianceApi.updateLegalHold(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "legal-holds"] });
    },
  });
}

export function useReleaseLegalHold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => complianceApi.releaseLegalHold(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "legal-holds"] });
    },
  });
}

export function useCreateAuditExport() {
  return useMutation({ mutationFn: (input: CreateAuditExportInput) => complianceApi.createAuditExport(input) });
}

export function useAuditExport(id: string | null) {
  return useQuery({
    queryKey: ["compliance", "audit-export", id],
    queryFn: () => complianceApi.getAuditExport(id!),
    enabled: !!id,
    refetchInterval: (query) => (query.state.data?.status === "COMPLETED" || query.state.data?.status === "FAILED" ? false : 2000),
  });
}

export function useVerifyAuditChain() {
  return useMutation({ mutationFn: () => complianceApi.verifyAuditChain() });
}

export function useRetentionPolicies() {
  return useQuery({
    queryKey: ["compliance", "retention-policies"],
    queryFn: () => complianceApi.listRetentionPolicies(),
  });
}

export function useCreateRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateRetentionPolicyInput) => complianceApi.createRetentionPolicy(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "retention-policies"] });
    },
  });
}

export function useUpdateRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRetentionPolicyInput }) =>
      complianceApi.updateRetentionPolicy(id, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "retention-policies"] });
    },
  });
}

export function useDeleteRetentionPolicy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => complianceApi.deleteRetentionPolicy(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["compliance", "retention-policies"] });
    },
  });
}
