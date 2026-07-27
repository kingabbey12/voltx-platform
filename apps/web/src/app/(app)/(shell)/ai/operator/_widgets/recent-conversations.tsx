"use client";

import { MessageSquare } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useConversations } from "@/hooks/use-ai";

export function RecentConversationsWidget() {
  const { data, isLoading } = useConversations({ limit: 5, archived: false });

  const conversations = data?.items ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4" />
          Recent Conversations
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}
        {!isLoading && conversations.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-6 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground/50" />
            <p className="text-xs text-muted-foreground">No conversations yet</p>
          </div>
        )}
        {conversations.length > 0 && (
          <div className="space-y-1">
            {conversations.map((conv) => (
              <Link
                key={conv.id}
                href={`/ai/${conv.id}`}
                className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-xs transition-colors hover:bg-secondary"
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate flex-1">{conv.title || "Untitled"}</span>
                <span className="text-[11px] text-muted-foreground">{conv.provider}</span>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
