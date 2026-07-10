"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  CheckCircle2,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  ShieldAlert,
  Sparkles,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import Link from "next/link";
import { useConversations, useCreateConversation } from "@/hooks/use-ai";
import { useRunCommand } from "@/hooks/use-operator";
import { useOperatorStore, type CommandTurn } from "@/lib/stores/operator-store";
import { ActivityTimeline } from "@/components/layout/activity-timeline";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

const SUGGESTED_COMMANDS = [
  "Find every deal over $50,000",
  "What CRM activities are overdue?",
  "Summarize today's business",
];

export function AiCommandCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"ask" | "timeline" | "chats">("ask");

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="hidden shrink-0 overflow-hidden border-l border-border bg-card md:flex md:flex-col"
        >
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-border px-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Voltx Operator</span>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label="Close AI panel">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-border px-3 pt-2">
            <TabButton active={tab === "ask"} onClick={() => setTab("ask")}>
              Ask
            </TabButton>
            <TabButton active={tab === "timeline"} onClick={() => setTab("timeline")}>
              Timeline
            </TabButton>
            <TabButton active={tab === "chats"} onClick={() => setTab("chats")}>
              Chats
            </TabButton>
          </div>

          {tab === "ask" && <CommandCenterTab />}
          {tab === "timeline" && <ActivityTimeline />}
          {tab === "chats" && <ChatsTab onClose={onClose} />}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative px-2.5 pb-2.5 text-sm font-medium transition-colors",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
      {active && (
        <motion.div layoutId="command-center-tab" className="absolute inset-x-0 -bottom-px h-0.5 bg-primary" />
      )}
    </button>
  );
}

function CommandCenterTab() {
  const [input, setInput] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const allowActions = useOperatorStore((state) => state.allowActions);
  const setAllowActions = useOperatorStore((state) => state.setAllowActions);
  const turns = useOperatorStore((state) => state.turns);
  const { run } = useRunCommand();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRunning = turns[0]?.status === "running";
  const latestEventCount = turns[0]?.events.length ?? 0;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [latestEventCount]);

  function handleSubmit() {
    const objective = input.trim();
    if (!objective || isRunning) return;
    setInput("");
    void run(objective);
  }

  function handleToggleActions(checked: boolean) {
    if (checked) {
      setConfirmOpen(true);
    } else {
      setAllowActions(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Switch checked={allowActions} onCheckedChange={handleToggleActions} aria-label="Allow AI to take actions" />
          <span className="text-xs font-medium text-muted-foreground">
            {allowActions ? "Actions enabled" : "Read-only"}
          </span>
        </div>
        {allowActions && (
          <Badge variant="warning" className="text-[10px]">
            <ShieldAlert className="h-3 w-3" />
            Can create &amp; change data
          </Badge>
        )}
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 p-3">
            {turns.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <Bot className="h-4.5 w-4.5 text-primary" />
                </div>
                <p className="text-sm font-medium">Ask about your workspace</p>
                <p className="text-xs text-muted-foreground">
                  Real answers from your real CRM and workflow data.
                </p>
                <div className="mt-1 flex flex-col gap-1.5">
                  {SUGGESTED_COMMANDS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {[...turns].reverse().map((turn) => (
              <TurnCard key={turn.id} turn={turn} />
            ))}
            <div ref={scrollRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask the Operator..."
            className="min-h-[40px] flex-1 resize-none text-sm"
            rows={1}
          />
          <Button size="icon" onClick={handleSubmit} disabled={!input.trim() || isRunning} aria-label="Send command">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Allow the AI to take real actions?</DialogTitle>
            <DialogDescription>
              With actions enabled, the Operator can create tasks and draft workflows in your
              workspace on your behalf — genuine, persisted changes, not previews. It will still
              only search and read data for questions that don&apos;t require a change.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setAllowActions(true);
                setConfirmOpen(false);
              }}
            >
              Enable actions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TurnCard({ turn }: { turn: CommandTurn }) {
  const plan = turn.events.find((e) => e.type === "plan");
  const toolEvents = turn.events.filter(
    (e) => e.type === "tool_call_start" || e.type === "tool_call_result" || e.type === "tool_call_error",
  );

  const toolStatus = new Map<string, "running" | "done" | "error">();
  for (const event of toolEvents) {
    if (event.type === "tool_call_start") toolStatus.set(event.toolName, "running");
    if (event.type === "tool_call_result") toolStatus.set(event.toolName, "done");
    if (event.type === "tool_call_error") toolStatus.set(event.toolName, "error");
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground">
        {turn.objective}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm border border-border bg-secondary/40 px-3.5 py-3">
        {plan && plan.type === "plan" && plan.steps.length > 0 && (
          <ol className="flex flex-col gap-1 text-xs text-muted-foreground">
            {plan.steps.map((step, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="tabular-nums">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        )}

        {toolStatus.size > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {[...toolStatus.entries()].map(([toolName, status]) => (
              <Badge
                key={toolName}
                variant={status === "error" ? "destructive" : status === "done" ? "success" : "secondary"}
                className="text-[10px]"
              >
                {status === "running" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                {status === "done" && <CheckCircle2 className="h-2.5 w-2.5" />}
                {status === "error" && <XCircle className="h-2.5 w-2.5" />}
                <Wrench className="h-2.5 w-2.5" />
                {toolName.replace(/_/g, " ")}
              </Badge>
            ))}
          </div>
        )}

        {turn.status === "running" && !turn.finalText && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Thinking...
          </div>
        )}

        {turn.finalText && <p className="whitespace-pre-wrap text-sm">{turn.finalText}</p>}

        {turn.status === "error" && (
          <p className="text-xs text-destructive">{turn.error ?? "Something went wrong."}</p>
        )}

        {turn.status === "waiting_approval" && (
          <div className="flex flex-col gap-1.5 rounded-lg border border-warning/30 bg-warning/10 px-2.5 py-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-warning">
              <ShieldAlert className="h-3.5 w-3.5" />
              Waiting on your approval to continue
            </div>
            <Link
              href="/ai/operator"
              className="text-xs font-medium text-primary underline underline-offset-2"
            >
              Review in AI Operator
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatsTab({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { data, isLoading } = useConversations({ limit: 8 });
  const createConversation = useCreateConversation();

  async function startNewChat() {
    try {
      const conversation = await createConversation.mutateAsync({});
      onClose();
      router.push(`/ai/${conversation.id}`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div className="flex-1 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="flex flex-col gap-1 p-3">
          <Button
            variant="outline"
            className="mb-2 justify-start"
            onClick={startNewChat}
            isLoading={createConversation.isPending}
          >
            <Plus className="h-4 w-4" />
            New conversation
          </Button>

          {isLoading && (
            <div className="flex flex-col gap-2 px-1 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-secondary/60" />
              ))}
            </div>
          )}

          {!isLoading && data?.items.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4.5 w-4.5 text-primary" />
              </div>
              <p className="text-sm font-medium">No conversations yet</p>
              <p className="text-xs text-muted-foreground">Start one to chat with an AI agent directly.</p>
            </div>
          )}

          {data?.items.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => {
                onClose();
                router.push(`/ai/${conversation.id}`);
              }}
              className="flex items-start gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm transition-colors hover:bg-secondary"
            >
              <MessageSquare className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{conversation.title}</p>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(conversation.updatedAt)}</p>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
