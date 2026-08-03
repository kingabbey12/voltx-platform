"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  CheckCircle2,
  History,
  Loader2,
  Send,
  ShieldAlert,
  Square,
  Wrench,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownMessage } from "@/components/ai/markdown-message";
import { assistantApi, type AssistantSession } from "@/lib/api/assistant";
import { streamSse } from "@/lib/ai/sse-client";
import { parseAgentStreamEvent, type AgentStreamEvent } from "@/lib/ai/stream-events";
import { friendlyErrorMessage } from "@/lib/api/api-error";

interface AssistantTurn {
  id: string;
  objective: string;
  output: string;
  events: AgentStreamEvent[];
  status: "running" | "completed" | "waiting_approval" | "failed";
  error?: string;
}

export default function AssistantPage() {
  const [session, setSession] = useState<AssistantSession | null>(null);
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [input, setInput] = useState("");
  const [loadingSession, setLoadingSession] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const activeTurn = turns.find((turn) => turn.status === "running") ?? null;

  async function startSession() {
    setLoadingSession(true);
    setError(null);
    try {
      setSession(await assistantApi.createSession());
    } catch (requestError) {
      setError(friendlyErrorMessage(requestError));
    } finally {
      setLoadingSession(false);
    }
  }

  async function run(objective: string) {
    if (!session || !objective.trim() || activeTurn) return;

    const turn: AssistantTurn = {
      id: crypto.randomUUID(),
      objective: objective.trim(),
      output: "",
      events: [],
      status: "running",
    };
    setTurns((current) => [...current, turn]);
    setInput("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const frame of streamSse(
        "/ai/assistant/run/stream",
        { conversationId: session.conversationId, objective: turn.objective },
        controller.signal,
      )) {
        const event = parseAgentStreamEvent(frame.event, frame.data);
        if (!event) continue;

        setTurns((current) =>
          current.map((existing) => {
            if (existing.id !== turn.id) return existing;
            const output =
              event.type === "content_delta"
                ? `${existing.output}${event.delta}`
                : event.type === "message_end" && event.outputText
                  ? event.outputText
                  : existing.output;
            const status =
              event.type === "run_paused_for_approval"
                ? "waiting_approval"
                : event.type === "error"
                  ? "failed"
                  : event.type === "done"
                    ? "completed"
                    : existing.status;
            return {
              ...existing,
              output,
              events: [...existing.events, event],
              status,
              ...(event.type === "error" ? { error: event.message } : {}),
            };
          }),
        );
      }
    } catch (streamError) {
      if (!controller.signal.aborted) {
        const message = friendlyErrorMessage(streamError);
        setError(message);
        setTurns((current) =>
          current.map((existing) =>
            existing.id === turn.id ? { ...existing, status: "failed", error: message } : existing,
          ),
        );
      }
    } finally {
      abortRef.current = null;
      setTurns((current) =>
        current.map((existing) =>
          existing.id === turn.id && existing.status === "running"
            ? { ...existing, status: "completed" }
            : existing,
        ),
      );
    }
  }

  return (
    <div className="mx-auto grid min-h-[calc(100svh-4rem)] max-w-7xl grid-cols-1 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex min-h-0 flex-col border-x border-border">
        <header className="flex items-center justify-between gap-4 border-b border-border px-5 py-4 sm:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold">Executive Assistant</h1>
              <p className="text-sm text-muted-foreground">Evidence-led decisions and approval-gated actions.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link href="/ai"><History className="h-4 w-4" />History</Link>
          </Button>
        </header>

        {!session ? (
          <div className="flex flex-1 items-center justify-center px-5 py-12">
            <div className="max-w-md text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                <Bot className="h-7 w-7" />
              </div>
              <h2 className="mt-5 text-xl font-semibold">Start an executive session</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                The assistant uses only data you are authorized to access. It cites available evidence and pauses for approval before consequential actions.
              </p>
              <Button className="mt-6" onClick={startSession} isLoading={loadingSession}>
                Start session
              </Button>
              {error && <p className="mt-4 text-sm text-destructive">{error}</p>}
            </div>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-6 sm:px-7">
              {turns.length === 0 && (
                <div className="border-b border-border pb-6">
                  <p className="text-sm text-muted-foreground">Choose a verified business question or write your own.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {session.suggestedPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => setInput(prompt)}
                        className="border border-border px-3 py-3 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((turn) => <AssistantTurnCard key={turn.id} turn={turn} />)}
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>

            <form
              className="border-t border-border p-4 sm:p-5"
              onSubmit={(event) => {
                event.preventDefault();
                void run(input);
              }}
            >
              <Textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask about priorities, risks, pipeline, finances, or next actions..."
                className="min-h-[92px] resize-none"
                disabled={Boolean(activeTurn)}
              />
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Actions require approval when policy requires it.</p>
                {activeTurn ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => abortRef.current?.abort()}>
                    <Square className="h-3.5 w-3.5" />Stop
                  </Button>
                ) : (
                  <Button type="submit" size="sm" disabled={!input.trim()}>
                    <Send className="h-3.5 w-3.5" />Ask
                  </Button>
                )}
              </div>
            </form>
          </>
        )}
      </section>

      <aside className="border-r border-border bg-muted/20 p-5 lg:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Session controls</p>
        <div className="mt-4 space-y-3 text-sm">
          <div className="border-l-2 border-primary pl-3">
            <p className="font-medium">Bounded context</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">The assistant receives tenant-scoped conversation context and can only invoke tools allowed by your permissions.</p>
          </div>
          <div className="border-l-2 border-warning pl-3">
            <p className="font-medium">Approvals</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">High-impact actions stop for a recorded decision before execution.</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function AssistantTurnCard({ turn }: { turn: AssistantTurn }) {
  const toolEvents = turn.events.filter(
    (event) => event.type === "tool_call_start" || event.type === "tool_call_result" || event.type === "tool_call_error",
  );
  const plan = turn.events.find((event) => event.type === "plan");

  return (
    <article className="space-y-3">
      <div className="ml-auto max-w-2xl bg-primary px-4 py-3 text-sm text-primary-foreground">
        {turn.objective}
      </div>
      <div className="max-w-3xl border border-border bg-card p-4">
        {plan?.type === "plan" && plan.steps.length > 0 && (
          <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {plan.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        )}
        {toolEvents.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {toolEvents.map((event, index) => (
              <span key={`${event.type}-${index}`} className="inline-flex items-center gap-1 border border-border px-2 py-1 text-xs text-muted-foreground">
                {event.type === "tool_call_error" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> : event.type === "tool_call_result" ? <CheckCircle2 className="h-3.5 w-3.5 text-success" /> : <Wrench className="h-3.5 w-3.5 text-primary" />}
                {event.toolName.replaceAll("_", " ")}
              </span>
            ))}
          </div>
        )}
        {turn.status === "running" && !turn.output && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Working with authorized sources...</div>}
        {turn.output && <MarkdownMessage content={turn.output} />}
        {turn.status === "waiting_approval" && <div className="mt-4 flex items-start gap-2 border border-warning/40 bg-warning/10 p-3 text-sm"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" /><span>Waiting for an approval decision before continuing this action.</span></div>}
        {turn.status === "failed" && <p className="mt-3 text-sm text-destructive">{turn.error ?? "The assistant could not complete this request."}</p>}
      </div>
    </article>
  );
}