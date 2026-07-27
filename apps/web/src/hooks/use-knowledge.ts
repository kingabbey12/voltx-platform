import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  knowledgeApi,
  type CreateKnowledgeSourceInput,
  type UpdateKnowledgeSourceInput,
  type IngestKnowledgeDocumentInput,
} from "@/lib/api/knowledge";

export function useKnowledgeSources(query: { page?: number; limit?: number } = {}) {
  return useQuery({
    queryKey: ["knowledge", "sources", query],
    queryFn: () => knowledgeApi.listSources(query),
  });
}

export function useKnowledgeSource(id: string | null) {
  return useQuery({
    queryKey: ["knowledge", "sources", id],
    queryFn: () => knowledgeApi.getSource(id!),
    enabled: !!id,
  });
}

export function useCreateKnowledgeSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateKnowledgeSourceInput) => knowledgeApi.createSource(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "sources"] });
    },
  });
}

export function useUpdateKnowledgeSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string } & UpdateKnowledgeSourceInput) =>
      knowledgeApi.updateSource(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "sources"] });
    },
  });
}

export function useDeleteKnowledgeSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.deleteSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "sources"] });
    },
  });
}

export function useReindexSource() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.reindexSource(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "sources"] });
    },
  });
}

export function useKnowledgeDocuments(query: { page?: number; limit?: number; sourceId?: string } = {}) {
  return useQuery({
    queryKey: ["knowledge", "documents", query],
    queryFn: () => knowledgeApi.listDocuments(query),
  });
}

export function useIngestDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceId, ...input }: { sourceId: string } & IngestKnowledgeDocumentInput) =>
      knowledgeApi.ingestDocument(sourceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "documents"] });
    },
  });
}

export function useDeleteKnowledgeDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.deleteDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "documents"] });
    },
  });
}

export function useRefreshDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => knowledgeApi.refreshDocument(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge", "documents"] });
    },
  });
}

export function useKnowledgeSearch() {
  return useMutation({
    mutationFn: (input: { query: string; topK?: number; sourceIds?: string[]; sourceTypes?: string[] }) =>
      knowledgeApi.search(input),
  });
}

export function useKnowledgePreview() {
  return useMutation({
    mutationFn: (input: { query: string; topK?: number; sourceIds?: string[]; sourceTypes?: string[] }) =>
      knowledgeApi.preview(input),
  });
}

export function useKnowledgeHealth() {
  return useQuery({
    queryKey: ["knowledge", "health"],
    queryFn: () => knowledgeApi.getHealth(),
  });
}

export function useKnowledgeStats() {
  return useQuery({
    queryKey: ["knowledge", "stats"],
    queryFn: () => knowledgeApi.getStats(),
  });
}

export function useTraverseGraph(
  params: { type: string; externalId: string; hops?: number } | null,
) {
  return useQuery({
    queryKey: ["knowledge", "graph", params],
    queryFn: () => knowledgeApi.traverseGraph(params!),
    enabled: !!params && !!params.type && !!params.externalId,
  });
}
