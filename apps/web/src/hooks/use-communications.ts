import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  communicationsApi,
  type ListConversationsQuery,
} from "@/lib/api/communications";

export function useChannelConnections(query: { channel?: string } = {}) {
  return useQuery({
    queryKey: ["comms-connections", query],
    queryFn: () => communicationsApi.listConnections(query),
  });
}

export function useInitiateCommsOAuth() {
  return useMutation({ mutationFn: communicationsApi.initiateOAuth });
}

export function useCompleteCommsOAuth() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: communicationsApi.completeOAuth,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comms-connections"] }),
  });
}

export function useDisconnectCommsConnection() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => communicationsApi.disconnectConnection(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["comms-connections"] }),
  });
}

export function useConversations(query: ListConversationsQuery = {}) {
  return useQuery({
    queryKey: ["conversations", query],
    queryFn: () => communicationsApi.listConversations(query),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ["conversations", id],
    queryFn: () => communicationsApi.getConversation(id as string),
    enabled: !!id,
  });
}

export function useUpdateConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; status?: string; priority?: string; unread?: boolean; assigneeId?: string | null }) =>
      communicationsApi.updateConversation(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conversations"] }),
  });
}

export function useMessages(conversationId: string | null) {
  return useQuery({
    queryKey: ["conversation-messages", conversationId],
    queryFn: () => communicationsApi.listMessages(conversationId as string),
    enabled: !!conversationId,
  });
}

export function useSendCommsMessage(conversationId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => communicationsApi.sendMessage(conversationId, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", conversationId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}
