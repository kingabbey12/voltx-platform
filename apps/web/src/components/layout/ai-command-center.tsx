"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
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
import { useWorkspaceContext } from "@/lib/ai/context-engine";
import { ActivityTimeline } from "@/components/layout/activity-timeline";
import { formatRelativeTime } from "@/lib/format";
import { toast } from "sonner";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

const SUGGESTED_COMMANDS = [
  "What changed on this page?",
  "Find every deal over $50,000",
  "What CRM activities are overdue?",
  "Summarize today's business",
];

const PAGE_CONTEXT = [
  { match: (path: string) => path === "/dashboard", label: "Executive Dashboard", context: "Executive snapshot, verified priorities, risks, opportunities, and analytics.", warning: "Recommendations shown here are backed by the dashboard response; unavailable operational trends remain explicitly unavailable.", next: "Review the highest-urgency supported decision.", href: "#executive-priorities", action: "Open executive priorities" },
  { match: (path: string) => path.startsWith("/crm"), label: "CRM", context: "Companies, contacts, leads, opportunities, and activities in the current workspace.", warning: "This panel has page context but no aggregate CRM risk feed. Use verified dashboard recommendations for executive decisions.", next: "Review the records currently in view or open the dashboard decision queue.", href: "/dashboard#executive-priorities", action: "Open decision queue" },
  { match: (path: string) => path.startsWith("/inbox"), label: "Communications", context: "Current conversations and their existing channel, priority, and message state.", warning: "Communication volume and backlog trends are not exposed to the executive API, so no aggregate claim is made here.", next: "Review the highest-priority conversation or ask the Copilot to summarize an open thread.", href: "/inbox", action: "Open Inbox" },
  { match: (path: string) => path.startsWith("/workflows"), label: "Automation", context: "Existing workflow definitions, statuses, approvals, and run records on this page.", warning: "Workflow performance is only presented where execution data is already exposed; no platform-wide workflow trend is inferred.", next: "Review a workflow run or approval before changing automation behavior.", href: "/workflows", action: "Open Workflows" },
  { match: (path: string) => path.startsWith("/ai/knowledge"), label: "Knowledge", context: "Indexed sources, documents, and search results available to the workspace.", warning: "Knowledge graph relationships remain unavailable until the current indexing APIs expose them.", next: "Review source health or search the indexed knowledge base.", href: "/ai/knowledge", action: "Open Knowledge" },
  { match: (path: string) => path.startsWith("/settings"), label: "Settings", context: "Workspace configuration and connected operational controls.", warning: "Settings do not expose executive recommendations; the Copilot remains read-only until you explicitly enable actions.", next: "Review the current configuration before making an operational change.", href: "/settings", action: "Open Settings" },
  { match: (path: string) => path.startsWith("/ai"), label: "AI workspace", context: "Existing agents, runs, approvals, chats, and operational AI controls.", warning: "Agent activity is presented only when existing agent runs or recommendations are available.", next: "Inspect an existing run, approval, or agent capability.", href: "/ai/operator", action: "Open AI Operator" },
] as const;

function pageContextFor(pathname: string) {
  return PAGE_CONTEXT.find((entry) => entry.match(pathname)) ?? { label: "Current workspace", context: "The current route and workspace context available to the Copilot.", warning: "No page-specific recommendation feed is exposed on this route.", next: "Use the dashboard decision queue for verified executive recommendations.", href: "/dashboard#executive-priorities", action: "Open decision queue" };
}

export function AiCommandCenter({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [tab, setTab] = useState<"ask" | "timeline" | "chats">("ask");

  return (
    <AnimatePresence>
      {open && (
        <>
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 420, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="hidden shrink-0 overflow-hidden border-l border-white/[0.08] bg-[linear-gradient(180deg,hsl(0_0%_7%/0.96),hsl(0_0%_3%/0.98))] shadow-[-24px_0_80px_-44px_black] md:flex md:flex-col"
        >
          <div className="relative flex h-[76px] shrink-0 items-center justify-between overflow-hidden border-b border-white/[0.07] px-5">
            <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-[hsl(268_83%_68%/0.18)] blur-3xl" />
            <div className="flex items-center gap-2">
              <span className="relative grid h-10 w-10 place-items-center rounded-2xl border border-[hsl(268_83%_68%/0.28)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)] shadow-[0_10px_24px_-18px_hsl(268_83%_68%/0.9)]"><Sparkles className="h-4.5 w-4.5" /></span>
              <div className="relative"><p className="text-sm font-semibold tracking-tight">AI Copilot</p><p className="text-[11px] text-muted-foreground">Context-aware operator</p></div>
            </div>
            <Button variant="ghost" size="icon" className="relative h-8 w-8 rounded-xl" onClick={onClose} aria-label="Close AI panel">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex shrink-0 gap-1 border-b border-white/[0.07] px-4 pt-3">
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
        <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
          <DialogContent hideClose className="bottom-0 left-0 top-auto flex max-h-[82svh] max-w-none translate-x-0 translate-y-0 flex-col gap-0 rounded-t-[28px] border-x-0 border-b-0 border-white/[0.10] bg-[linear-gradient(180deg,hsl(268_83%_68%/0.10),transparent_24%),hsl(0_0%_5%/0.99)] p-0 shadow-[0_-28px_80px_-40px_black] md:hidden">
            <DialogTitle className="sr-only">AI Copilot</DialogTitle>
            <div className="flex shrink-0 items-center justify-between border-b border-white/[0.08] px-5 py-4"><div className="flex items-center gap-2"><span className="grid h-10 w-10 place-items-center rounded-2xl border border-[hsl(268_83%_68%/0.28)] bg-[hsl(268_83%_68%/0.10)] text-[hsl(268_83%_76%)]"><Sparkles className="h-4.5 w-4.5" /></span><div><p className="text-sm font-semibold">AI Copilot</p><p className="text-[11px] text-muted-foreground">Current workspace, at hand</p></div></div><Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={onClose} aria-label="Close AI Copilot"><X className="h-4 w-4" /></Button></div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><CommandCenterTab /></div>
          </DialogContent>
        </Dialog>
        </>
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
        "relative rounded-t-xl px-3 pb-2.5 text-sm font-medium transition-colors",
        active ? "bg-white/[0.035] text-foreground" : "text-muted-foreground hover:text-foreground",
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
  const workspaceContext = useWorkspaceContext();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isRunning = turns[0]?.status === "running";
  const latestEventCount = turns[0]?.events.length ?? 0;
  const currentPage = workspaceContext.find((entry) => entry.startsWith("Current page:"))?.replace("Current page: ", "") ?? "Current workspace";
  const pageContext = pageContextFor(pathname);

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
      <div className="border-b border-white/[0.07] px-4 py-3">
        <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch checked={allowActions} onCheckedChange={handleToggleActions} aria-label="Allow AI to take actions" />
          <span className="text-xs font-medium text-muted-foreground">
            {allowActions ? "Action mode" : "Read-only mode"}
          </span>
        </div>
        {allowActions && (
          <Badge variant="warning" className="text-[10px]">
            <ShieldAlert className="h-3 w-3" />
            Can create &amp; change data
          </Badge>
        )}</div>
        <p className="mt-2 truncate rounded-full border border-white/[0.07] bg-black/20 px-2.5 py-1 text-[10px] text-muted-foreground" title={currentPage}>Aware of: {currentPage}</p>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-4 p-4">
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3.5" aria-label={`AI context: ${pageContext.label}`}>
              <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-primary">AI context</p><h3 id="copilot-context-title" className="mt-1 text-sm font-semibold">{pageContext.label}</h3></div><span className="h-2 w-2 rounded-full bg-success shadow-[0_0_10px_hsl(var(--success)/0.75)]" aria-label="Context active" /></div>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{pageContext.context}</p>
              <div className="mt-3 rounded-xl border border-warning/20 bg-warning/[0.06] p-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-warning">Data boundary</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{pageContext.warning}</p></div>
              <p className="mt-3 text-xs font-medium text-foreground">Next: <span className="font-normal text-muted-foreground">{pageContext.next}</span></p>
              <Link href={pageContext.href} className="mt-3 inline-flex min-h-9 items-center gap-1 text-xs font-medium text-primary hover:underline" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>{pageContext.action}<Plus className="h-3.5 w-3.5" aria-hidden /></Link>
            </section>
            {turns.length === 0 && (
              <div className="relative overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,hsl(268_83%_68%/0.10),transparent_55%),hsl(0_0%_3%/0.42)] px-4 py-8 text-center">
                <div aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/15 blur-2xl" />
                <div className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <p className="relative mt-4 text-sm font-semibold">Your business copilot is ready</p>
                <p className="relative mt-1 text-xs leading-relaxed text-muted-foreground">
                  Ask what changed, why it matters, or what you can do next with your real workspace data.
                </p>
                <div className="relative mt-5 flex flex-col gap-1.5">
                  {SUGGESTED_COMMANDS.map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => setInput(suggestion)}
                      className="rounded-xl border border-white/[0.08] bg-black/20 px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/[0.06] hover:text-foreground"
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

      <div className="shrink-0 border-t border-white/[0.07] p-4">
        <div className="rounded-2xl border border-white/[0.09] bg-black/25 p-2 transition-colors focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder="Ask your business copilot..."
            className="min-h-[68px] w-full resize-none border-0 bg-transparent px-2 py-2 text-sm shadow-none focus-visible:ring-0"
            rows={1}
          />
          <div className="flex items-center justify-between gap-2 px-1 pt-1"><span className="text-[10px] text-muted-foreground">{allowActions ? "Actions require your approval when needed" : "Read-only analysis is active"}</span><Button size="icon" className="h-9 w-9 rounded-xl" onClick={handleSubmit} disabled={!input.trim() || isRunning} aria-label="Send command">
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button></div>
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
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm border border-primary/20 bg-primary px-3.5 py-2.5 text-sm text-primary-foreground shadow-[0_10px_24px_-20px_hsl(var(--primary)/0.9)]">
        {turn.objective}
      </div>

      <div className="flex flex-col gap-2 rounded-2xl rounded-tl-sm border border-white/[0.08] bg-black/20 px-3.5 py-3">
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
          <div className="space-y-2 py-1"><div className="skeleton h-3 w-4/5 rounded-full" /><div className="skeleton h-3 w-3/5 rounded-full" /></div>
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
