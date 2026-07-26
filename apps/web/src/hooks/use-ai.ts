import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, type ListConversationsQuery } from "@/lib/api/ai";

export function useConversations(query: ListConversationsQuery = {}) {
  return useQuery({
    queryKey: ["ai", "conversations", query],
    queryFn: () => aiApi.listConversations(query),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["ai", "conversations", id],
    queryFn: () => aiApi.getConversation(id!),
    enabled: !!id,
  });
}

export function useConversationMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["ai", "conversations", conversationId, "messages"],
    queryFn: () => aiApi.listMessages(conversationId!),
    enabled: !!conversationId,
  });
}

export function useCreateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: aiApi.createConversation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; pinned?: boolean; archived?: boolean }) =>
      aiApi.updateConversation(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => aiApi.deleteConversation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
}

export function useSendMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, attachmentIds }: { content: string; attachmentIds?: string[] }) =>
      aiApi.sendMessage(conversationId, content, undefined, attachmentIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations", conversationId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["ai", "conversations"] });
    },
  });
}
