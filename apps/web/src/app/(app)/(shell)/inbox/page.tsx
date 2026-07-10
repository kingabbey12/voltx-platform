"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Inbox as InboxIcon, Mail, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { useConversations } from "@/hooks/use-communications";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CommsChannel } from "@/lib/api/communications";

type FilterKey = "all" | "unread" | "pinned" | "archived";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "pinned", label: "Pinned" },
  { key: "archived", label: "Archived" },
];

const CHANNEL_LABEL: Record<CommsChannel, string> = {
  GMAIL: "Gmail",
  OUTLOOK: "Outlook",
  WHATSAPP: "WhatsApp",
  TWILIO_VOICE: "Voice",
  TWILIO_SMS: "SMS",
  SLACK: "Slack",
  TEAMS: "Teams",
};

const PRIORITY_VARIANT: Record<string, "secondary" | "warning" | "destructive" | "outline"> = {
  LOW: "outline",
  NORMAL: "secondary",
  HIGH: "warning",
  URGENT: "destructive",
};

export default function InboxPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");

  const { data, isLoading } = useConversations({
    unread: filter === "unread" ? true : undefined,
    status: filter === "pinned" ? "PINNED" : filter === "archived" ? "ARCHIVED" : undefined,
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Inbox</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every conversation, every channel, in one place.
        </p>
      </div>

      <div className="mt-6 flex gap-1 border-b border-border">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "relative px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
              filter === f.key && "text-foreground",
            )}
          >
            {f.label}
            {filter === f.key && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={InboxIcon}
            title="No conversations yet"
            description="Connect Gmail or Slack in Settings to start seeing conversations here."
            action={
              <Button size="sm" variant="outline" onClick={() => router.push("/settings/communications")}>
                Connect a channel
              </Button>
            }
          />
        )}

        <div className="divide-y divide-border">
          {data?.items.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => router.push(`/inbox/${conversation.id}`)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-secondary/50",
                conversation.unread && "bg-primary/[0.03]",
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Mail className="h-4.5 w-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className={cn("truncate text-sm", conversation.unread ? "font-semibold" : "font-medium")}>
                    {conversation.subject || "(no subject)"}
                  </p>
                  {conversation.status === "PINNED" && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  {conversation.status === "ARCHIVED" && (
                    <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {CHANNEL_LABEL[conversation.channel]} &bull;{" "}
                  {conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "no messages"}
                </p>
              </div>
              {conversation.priority !== "NORMAL" && (
                <Badge variant={PRIORITY_VARIANT[conversation.priority]} className="shrink-0 text-[10px]">
                  {conversation.priority}
                </Badge>
              )}
              {conversation.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
