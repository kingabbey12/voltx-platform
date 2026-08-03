"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Archive,
  ChevronRight,
  Mail,
  MessageCircleMore,
  MessagesSquare,
  Pin,
  Phone,
  Send,
  Sparkles,
  UsersRound,
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
import { DetailLoadState } from "@/components/detail-load-state";
import type { CommsChannel } from "@/lib/api/communications";

interface SummaryResult {
  summary: string;
  sentiment?: string;
  urgency?: string;
  intent?: string;
}

const CHANNEL_PRESENTATION: Record<CommsChannel, { icon: typeof Mail; label: string; tone: string }> = {
  GMAIL: { icon: Mail, label: "Email", tone: "border-destructive/20 bg-destructive/10 text-destructive" },
  OUTLOOK: { icon: Mail, label: "Email", tone: "border-info/20 bg-info/10 text-info" },
  WHATSAPP: { icon: MessageCircleMore, label: "WhatsApp", tone: "border-success/20 bg-success/10 text-success" },
  TWILIO_VOICE: { icon: Phone, label: "Call", tone: "border-warning/20 bg-warning/10 text-warning" },
  TWILIO_SMS: { icon: MessagesSquare, label: "SMS", tone: "border-info/20 bg-info/10 text-info" },
  SLACK: { icon: MessagesSquare, label: "Slack", tone: "border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]" },
  TEAMS: { icon: UsersRound, label: "Teams", tone: "border-[hsl(268_83%_68%/0.22)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]" },
};

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const {
    data: conversation,
    isLoading: loadingConversation,
    error: conversationError,
    refetch: refetchConversation,
  } = useConversation(id);
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
  if (!conversation) {
    return (
      <DetailLoadState
        entityName="Conversation"
        backHref="/inbox"
        backLabel="Back to inbox"
        error={conversationError}
        onRetry={() => void refetchConversation()}
      />
    );
  }
  const channel = CHANNEL_PRESENTATION[conversation.channel];
  const ChannelIcon = channel.icon;

  return (
    <div className="mx-auto flex h-full max-w-[1400px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="surface-raised relative flex flex-wrap items-center gap-3 overflow-hidden rounded-[24px] p-4 sm:p-5">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-[hsl(268_83%_68%/0.13)] blur-3xl" />
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          onClick={() => router.push("/inbox")}
          aria-label="Back to inbox"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-2xl border", channel.tone)}><ChannelIcon className="h-4.5 w-4.5" /></div>
        <div className="relative min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{channel.label} conversation</p><h1 className="truncate text-base font-semibold tracking-tight sm:text-lg">{conversation.subject || "Untitled conversation"}</h1></div>

        <div className="relative flex w-full items-center justify-end gap-2 sm:ml-auto sm:w-auto">
        <Select value={conversation.priority} onValueChange={handlePriorityChange}>
          <SelectTrigger className="relative h-9 w-[112px] rounded-xl border-white/[0.09] bg-black/20 text-xs">
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
          className="relative h-9 w-9 rounded-xl"
          onClick={togglePin}
          aria-label={conversation.status === "PINNED" ? "Unpin" : "Pin"}
        >
          <Pin className={cn("h-4 w-4", conversation.status === "PINNED" && "fill-current")} />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          onClick={toggleArchive}
          aria-label={conversation.status === "ARCHIVED" ? "Unarchive" : "Archive"}
        >
          <Archive className="h-4 w-4" />
        </Button>
        </div>
      </div>

      <div className="surface-widget mt-4 flex shrink-0 flex-wrap gap-2 rounded-2xl p-2.5">
        <Button variant="outline" size="sm" onClick={handleSummarize} isLoading={summarize.loading && summaryOpen}>
          <Sparkles className="h-3.5 w-3.5" />
          Summarize
        </Button>
        <Button variant="outline" size="sm" onClick={handleDraftReply} isLoading={draftReply.loading}>
          <Sparkles className="h-3.5 w-3.5" />
          Draft reply
        </Button>
      </div>

      <div className="mt-4 grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col gap-4">
        <div className="surface-widget min-h-0 flex-1 overflow-y-auto rounded-[24px] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between border-b border-white/[0.06] pb-3"><div><p className="text-sm font-semibold tracking-tight">Conversation timeline</p><p className="mt-0.5 text-xs text-muted-foreground">{messages?.total ?? 0} messages in chronological order</p></div><span className="rounded-full border border-white/[0.08] bg-white/[0.035] px-2 py-1 text-[10px] text-muted-foreground">{channel.label}</span></div>
          <div className="relative flex flex-col gap-4 before:absolute before:bottom-3 before:left-5 before:top-3 before:w-px before:bg-white/[0.06]">
          {messages?.items.map((message) => (
            <motion.div
              key={message.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={cn("relative flex pl-10", message.direction === "OUTBOUND" && "justify-end pl-0 pr-10")}
            >
              <span className={cn("absolute top-3 grid h-10 w-10 place-items-center rounded-2xl border bg-card", message.direction === "OUTBOUND" ? "right-0 border-primary/25 text-primary" : `left-0 ${channel.tone}`)}>{message.direction === "OUTBOUND" ? <Send className="h-3.5 w-3.5" /> : <ChannelIcon className="h-4 w-4" />}</span>
              <div
                className={cn(
                  "max-w-[82%] rounded-[20px] border px-4 py-3 text-sm leading-relaxed shadow-[0_12px_28px_-24px_black]",
                  message.direction === "OUTBOUND"
                    ? "border-primary/20 bg-primary text-primary-foreground"
                    : "border-white/[0.07] bg-black/25 text-secondary-foreground",
                )}
              >
                <p className="whitespace-pre-wrap">{message.body}</p>
                <p
                  className={cn(
                    "mt-1 text-[10px]",
                    message.direction === "OUTBOUND" ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {formatRelativeTime(message.createdAt)} <span className="text-white/30">/</span> {message.status}
                </p>
              </div>
            </motion.div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="surface-widget flex items-end gap-2 rounded-[24px] p-3 sm:p-4">
        <div className="flex-1 rounded-2xl border border-white/[0.09] bg-black/25 transition-colors focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Reply via ${channel.label}...`}
          className="min-h-[76px] w-full resize-none border-0 bg-transparent px-3 py-3 shadow-none focus-visible:ring-0"
          rows={1}
        />
        </div><Button
          size="icon"
          className="h-11 w-11 shrink-0 rounded-2xl"
          onClick={handleSend}
          isLoading={sendMessage.isPending}
          disabled={!input.trim()}
          aria-label="Send reply"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div></div>

        <aside className="space-y-4">
          <section className="surface-widget rounded-[24px] p-5" aria-labelledby="conversation-intelligence-title"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-xl border border-[hsl(268_83%_68%/0.24)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]"><Sparkles className="h-4 w-4" /></span><div><h2 id="conversation-intelligence-title" className="text-sm font-semibold">AI workspace</h2><p className="text-[11px] text-muted-foreground">Supported actions</p></div></div><div className="mt-4 space-y-2"><Button variant="outline" className="w-full justify-between" onClick={handleSummarize} isLoading={summarize.loading && summaryOpen}>Summarize conversation<ChevronRight className="h-4 w-4" /></Button><Button variant="outline" className="w-full justify-between" onClick={handleDraftReply} isLoading={draftReply.loading}>Draft a reply<ChevronRight className="h-4 w-4" /></Button></div>{summarize.data && <div className="mt-4 rounded-2xl border border-[hsl(268_83%_68%/0.18)] bg-[hsl(268_83%_68%/0.07)] p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[hsl(268_83%_76%)]">Latest summary</p><p className="mt-2 line-clamp-5 text-xs leading-relaxed text-muted-foreground">{summarize.data.summary}</p></div>}</section>
          <section className="surface-widget rounded-[24px] p-5"><p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Conversation details</p><div className="mt-4 space-y-3 text-sm"><DetailRow label="Channel" value={channel.label} /><DetailRow label="Priority" value={conversation.priority} /><DetailRow label="Status" value={conversation.status} /><DetailRow label="Customer record" value={conversation.contactId ? "Linked contact" : "Not linked"} /><DetailRow label="Last activity" value={conversation.lastMessageAt ? formatRelativeTime(conversation.lastMessageAt) : "Awaiting first message"} /></div><p className="mt-5 rounded-2xl border border-white/[0.07] bg-black/20 p-3 text-xs leading-relaxed text-muted-foreground">Customer health, meetings, tasks, deals, invoices, and files appear here when those records are available to this conversation.</p></section>
        </aside>
      </div>

      <Dialog open={summaryOpen} onOpenChange={setSummaryOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Conversation summary
            </DialogTitle>
          </DialogHeader>
          {summarize.loading && <div className="space-y-3 py-2"><div className="skeleton h-4 w-4/5 rounded-full" /><div className="skeleton h-4 w-full rounded-full" /><div className="skeleton h-4 w-3/5 rounded-full" /></div>}
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] pb-3 last:border-0 last:pb-0"><span className="text-xs text-muted-foreground">{label}</span><span className="text-right text-xs font-medium">{value}</span></div>;
}
