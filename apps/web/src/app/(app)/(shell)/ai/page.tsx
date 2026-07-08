"use client";

import { useRouter } from "next/navigation";
import { Bot, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useConversations, useCreateConversation } from "@/hooks/use-ai";
import { formatRelativeTime } from "@/lib/format";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export default function AiIndexPage() {
  const router = useRouter();
  const { data, isLoading } = useConversations({ limit: 50 });
  const createConversation = useCreateConversation();

  async function startNewChat() {
    try {
      const conversation = await createConversation.mutateAsync({});
      router.push(`/ai/${conversation.id}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Chat</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask your AI agent anything about your workspace.
          </p>
        </div>
        <Button onClick={startNewChat} isLoading={createConversation.isPending}>
          <Plus className="h-4 w-4" />
          New conversation
        </Button>
      </div>

      <div className="mt-6 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={Bot}
            title="No conversations yet"
            description="Start a conversation to get help with your workspace."
            action={
              <Button size="sm" onClick={startNewChat}>
                <Plus className="h-4 w-4" />
                New conversation
              </Button>
            }
          />
        )}

        <div className="divide-y divide-border">
          {data?.items.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => router.push(`/ai/${conversation.id}`)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Bot className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{conversation.title}</p>
                <p className="text-xs text-muted-foreground">
                  {conversation.model} &bull; {formatRelativeTime(conversation.updatedAt)}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
