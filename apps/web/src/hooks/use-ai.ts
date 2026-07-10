import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { aiApi, type ListConversationsQuery } from "@/lib/api/ai";

export function useConversations(query: ListConversationsQuery = {}) {
  return useQuery({
    queryKey: ["ai", "conversations", query],
    queryFn: () => aiApi.listConversations(query),
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
