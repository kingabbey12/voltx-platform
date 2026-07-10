"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Archive,
  Loader2,
  Pin,
  Send,
  Sparkles,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useConversation,
  useMessages,
  useSendCommsMessage,
  useUpdateConversation,
} from "@/hooks/use-communications";
import { useCommsAiTool } from "@/hooks/use-comms-ai-tool";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LoadingScreen } from "@/components/loading-screen";

interface SummaryResult {
  summary: string;
  sentiment?: string;
  urgency?: string;
  intent?: string;
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: conversation, isLoading: loadingConversation } = useConversation(id);
  const { data: messages, isLoading: loadingMessages } = useMessages(id);
  const sendMessage = useSendCommsMessage(id);
  const updateConversation = useUpdateConversation();
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const summarize = useCommsAiTool<SummaryResult>();
  const draftReply = useCommsAiTool<{ draft: string }>();
  const [summaryOpen, setSummaryOpen] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages?.items.length]);

  useEffect(() => {
    if (conversation?.unread) {
      updateConversation.mutate({ id, unread: false });
    }
    // Only fire once when the conversation loads as unread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversation?.id]);

  async function handleSend() {
    const body = input.trim();
    if (!body || sendMessage.isPending) return;
    setInput("");
    try {
      await sendMessage.mutateAsync(body);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
      setInput(body);
    }
  }

  async function handleSummarize() {
    setSummaryOpen(true);
    await summarize.run("comms_summarize_conversation", { conversationId: id });
  }

  async function handleDraftReply() {
    await draftReply.run("comms_draft_reply", { conversationId: id });
  }

  useEffect(() => {
    if (draftReply.data?.draft) {
      setInput(draftReply.data.draft);
    }
  }, [draftReply.data]);

  async function togglePin() {
    try {
      await updateConversation.mutateAsync({
        id,
        status: conversation?.status === "PINNED" ? "OPEN" : "PINNED",
      });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function toggleArchive() {
    try {
      await updateConversation.mutateAsync({
        id,
        status: conversation?.status === "ARCHIVED" ? "OPEN" : "ARCHIVED",
      });
      if (conversation?.status !== "ARCHIVED") router.push("/inbox");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handlePriorityChange(priority: string) {
    try {
      await updateConversation.mutateAsync({ id, priority });
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (loadingConversation || loadingMessages) return <LoadingScreen />;
  if (!conversation) return null;

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col px-6 py-4">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => router.push("/inbox")}
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {conversation.subject || "(no subject)"}
        </h1>

        <Select value={conversation.priority} onValueChange={handlePriorityChange}>
          <SelectTrigger className="h-8 w-[110px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="NORMAL">Normal</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={togglePin}
          aria-label={conversation.status === "PINNED" ? "Unpin" : "Pin"}
        >
          <Pin className={cn("h-4 w-4", conversation.status === "PINNED" && "fill-current")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleArchive}
          aria-label={conversation.status === "ARCHIVED" ? "Unarchive" : "Archive"}
        >
          <Archive className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex shrink-0 gap-2 border-b border-border py-2.5">
        <Button variant="outline" size="sm" onClick={handleSummarize} isLoading={summarize.loading && summaryOpen}>
          <Sparkles className="h-3.5 w-3.5" />
          Summarize
        </Button>
        <Button variant="outline" size="sm" onClick={handleDraftReply} isLoading={draftReply.loading}>
          <Sparkles className="h-3.5 w-3.5" />
          Draft reply
        </Button>
        <Button variant="outline" size="sm" disabled className="ml-auto text-muted-foreground" title="Coming soon">
          <UserPlus className="h-3.5 w-3.5" />
          Link contact
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <div className="flex flex-col gap-3">
          {messages?.items.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("flex", message.direction === "OUTBOUND" && "justify-end")}
            >
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                  message.direction === "OUTBOUND"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    message.direction === "OUTBOUND" ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {formatRelativeTime(message.createdAt)} &bull; {message.status}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex items-end gap-2 border-t border-border pt-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Write a reply..."
          className="min-h-[44px] flex-1 resize-none"
          rows={1}
        />
        <Button
          size="icon"
          onClick={handleSend}
          isLoading={sendMessage.isPending}
          disabled={!input.trim()}
          aria-label="Send reply"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Conversation summary
            </DialogTitle>
          </DialogHeader>
          {summarize.loading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reading the conversation...
            </div>
          )}
          {summarize.error && <p className="text-sm text-destructive">{summarize.error}</p>}
          {summarize.data && (
            <div className="flex flex-col gap-3">
              <p className="text-sm leading-relaxed">{summarize.data.summary}</p>
              <div className="flex gap-1.5">
                {summarize.data.sentiment && <Badge variant="secondary">{summarize.data.sentiment}</Badge>}
                {summarize.data.urgency && <Badge variant="warning">{summarize.data.urgency}</Badge>}
                {summarize.data.intent && <Badge variant="outline">{summarize.data.intent}</Badge>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
