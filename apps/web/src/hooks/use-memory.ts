import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { memoryApi } from "@/lib/api/memory";
import { aiApi } from "@/lib/api/ai";

export function useMemories() {
  return useQuery({
    queryKey: ["ai-memories"],
    queryFn: () => memoryApi.list(),
  });
}

export function useCreateMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { category: string; content: string; importance?: number }) => {
      // Memories are anchored to a conversation id; manual entries from the
      // Settings page get a small dedicated conversation rather than
      // reusing whatever the user's Command Center session happens to be.
      const conversation = await aiApi.createConversation({ title: "Saved memories" });
      return memoryApi.create({ conversationId: conversation.id, ...input });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memories"] });
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => memoryApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memories"] });
    },
  });
}
