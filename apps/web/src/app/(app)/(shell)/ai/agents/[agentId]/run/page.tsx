"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Bot,
  ArrowLeft,
  Play,
  Square,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  MessageSquare,
  Sparkles,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgent } from "@/hooks/use-agents";
import { agentsApi, type AgentAllStreamEvent } from "@/lib/api/agents";
import { useCreateConversation } from "@/hooks/use-ai";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: string;
  type: "status" | "reasoning" | "tool_call" | "tool_result" | "tool_error" | "agent_event" | "error" | "completion" | "message";
  message: string;
  agentName?: string;
  depth?: number;
}

export default function RunAgentPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;

  const { data: agent, isLoading } = useAgent(agentId);
  const createConversation = useCreateConversation();

  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"single" | "autonomous">("single");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [result, setResult] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  function addLog(type: LogEntry["type"], message: string, extra?: Partial<LogEntry>) {
    setLogs((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        type,
        message,
        ...extra,
      },
    ]);
  }

  const handleStop = useCallback(() => {
    abortController?.abort();
    setIsRunning(false);
    addLog("status", "Execution cancelled by user");
  }, [abortController]);

  async function handleRun() {
    if (!agent || !prompt.trim()) return;

    setIsRunning(true);
    setResult(null);
    setRunId(null);
    setLogs([]);

    try {
      let convId = conversationId;
      if (!convId) {
        addLog("status", "Creating conversation...");
        const conv = await createConversation.mutateAsync({ title: `Agent: ${agent.name}` });
        convId = conv.id;
        setConversationId(convId);
      }
      if (!convId) throw new Error("Failed to create conversation");

      addLog("status", mode === "autonomous" ? "Starting autonomous run..." : "Starting run...");

      if (mode === "autonomous") {
        const ac = new AbortController();
        setAbortController(ac);

        const resultData = await agentsApi.runAutonomous(agentId, {
          conversationId: convId,
          objective: prompt.trim(),
        });

        setRunId(resultData.run.id);
        addLog("completion", `Autonomous run completed — ${resultData.run.status.toLowerCase()}`);
        if (resultData.assistantMessage) {
          setResult(resultData.assistantMessage.content);
          addLog("message", resultData.assistantMessage.content);
        }
        setIsRunning(false);
      } else {
        const ac = new AbortController();
        setAbortController(ac);

        try {
          const stream = await agentsApi.runAgentStream(agentId, {
            conversationId: convId,
            prompt: prompt.trim(),
          });

          for await (const event of stream) {
            handleStreamEvent(event);
          }
          addLog("status", "Run completed");
        } catch (err) {
          if ((err as Error)?.name === "AbortError") return;
          throw err;
        }
        setIsRunning(false);
      }
    } catch (error) {
      const message = friendlyErrorMessage(error);
      addLog("error", message);
      toast.error(message);
      setIsRunning(false);
    }
  }

  function handleStreamEvent(event: AgentAllStreamEvent) {
    switch (event.type) {
      case "status":
        addLog("status", event.status);
        break;
      case "reasoning":
        addLog("reasoning", `[${event.stage}] ${event.message}`);
        break;
      case "tool_call_start":
        addLog("tool_call", `Calling tool: ${event.toolName}`);
        break;
      case "tool_call_result":
        addLog("tool_result", `Tool ${event.toolName} completed in ${event.durationMs}ms`);
        break;
      case "tool_call_error":
        addLog("tool_error", `Tool ${event.toolName} failed: ${event.message}`);
        break;
      case "provider_event":
        if (typeof event.event === "object" && event.event && "content" in event.event) {
          addLog("message", String((event.event as Record<string, unknown>).content));
        }
        break;
      case "coordinator_started":
        addLog("status", `Coordinator started — objective: ${event.objective}`);
        break;
      case "agent_spawned":
        addLog("agent_event", `Spawned agent: ${event.agentName} (depth ${event.depth})`, { agentName: event.agentName, depth: event.depth });
        break;
      case "agent_working":
        addLog("agent_event", `Agent working: ${event.agentName}`);
        break;
      case "agent_completed":
        addLog("agent_event", `Agent completed: ${event.agentName} (${event.succeeded ? "succeeded" : "failed"})`, { agentName: event.agentName });
        break;
      case "coordinator_finished":
        addLog("completion", "Coordinator finished");
        setResult(event.outputText);
        break;
      case "agent_event":
        addLog("agent_event", `[${event.agentName}] depth=${event.depth}`, { agentName: event.agentName, depth: event.depth });
        handleStreamEvent(event.event);
        break;
    }
  }

  const LOG_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    status: Clock,
    reasoning: Sparkles,
    tool_call: Terminal,
    tool_result: CheckCircle2,
    tool_error: XCircle,
    agent_event: Bot,
    error: AlertTriangle,
    completion: CheckCircle2,
    message: MessageSquare,
  };

  const LOG_COLORS: Record<string, string> = {
    status: "text-muted-foreground",
    reasoning: "text-amber-600 dark:text-amber-400",
    tool_call: "text-blue-600 dark:text-blue-400",
    tool_result: "text-emerald-600 dark:text-emerald-400",
    tool_error: "text-red-600 dark:text-red-400",
    agent_event: "text-violet-600 dark:text-violet-400",
    error: "text-red-600 dark:text-red-400",
    completion: "text-emerald-600 dark:text-emerald-400",
    message: "text-foreground",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Bot className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Agent not found</p>
        <Button variant="outline" size="sm" onClick={() => router.push("/ai/agents")}>
          <ArrowLeft className="h-4 w-4" />
          Back to Agents
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex h-full max-w-5xl flex-col px-6 py-8">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-0.5 h-8 w-8 shrink-0 text-muted-foreground" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Run: {agent.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Execute the agent with a prompt or an objective.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "single" | "autonomous")}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs outline-none focus:border-primary"
            disabled={isRunning}
          >
            <option value="single">Single Turn</option>
            <option value="autonomous">Autonomous</option>
          </select>
        </div>
      </div>

      <div className="mt-4 grid flex-1 gap-6 lg:grid-cols-[1fr_380px]" style={{ minHeight: 0 }}>
        {/* Input and output */}
        <div className="flex flex-col gap-4" style={{ minHeight: 0 }}>
          <Card className="shrink-0">
            <CardContent className="p-4">
              <div className="flex flex-col gap-3">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder={mode === "autonomous" ? "Enter an objective for the agent to achieve autonomously..." : "Enter a prompt for the agent..."}
                  className="h-28 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  disabled={isRunning}
                />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={!!conversationId}
                      onChange={(e) => {
                        if (!e.target.checked) setConversationId(null);
                      }}
                      className="h-3.5 w-3.5 rounded border-border accent-primary"
                    />
                    Reuse conversation
                  </label>
                  <div className="flex items-center gap-2">
                    {isRunning && (
                      <Button size="sm" variant="outline" onClick={handleStop}>
                        <Square className="h-4 w-4" />
                        Stop
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={handleRun}
                      isLoading={isRunning}
                      disabled={!prompt.trim()}
                    >
                      {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                      {mode === "autonomous" ? "Run Autonomous" : "Run"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Result */}
          {result && (
            <Card className="shrink-0">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <MessageSquare className="h-4 w-4" />
                  Result
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap rounded-lg bg-muted p-4 text-xs leading-relaxed text-foreground">
                  {result}
                </div>
              </CardContent>
            </Card>
          )}

          {runId && (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => window.open(`/ai/agents/${agentId}/runs`, "_blank")}>
                View Run History
              </Button>
            </div>
          )}
        </div>

        {/* Execution Logs */}
        <Card className="flex flex-col" style={{ minHeight: 0 }}>
          <CardHeader className="shrink-0 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Terminal className="h-4 w-4" />
              Execution Logs
              {isRunning && <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              {!isRunning && logs.length > 0 && (
                <span className="ml-auto text-[11px] text-muted-foreground">{logs.length} events</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto p-0">
            {logs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Terminal className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground">
                  {isRunning ? "Waiting for events..." : "Run the agent to see execution logs."}
                </p>
              </div>
            )}
            {logs.length > 0 && (
              <div className="divide-y divide-border">
                {logs.map((log) => {
                  const Icon = LOG_ICONS[log.type] ?? Terminal;
                  return (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-2.5 px-4 py-2 text-xs leading-relaxed",
                        LOG_COLORS[log.type] ?? "text-muted-foreground",
                        log.type === "agent_event" && "pl-8",
                      )}
                    >
                      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        {log.agentName && (
                          <span className="mr-1.5 inline-flex items-center rounded bg-secondary px-1 py-0.5 text-[10px] font-medium text-secondary-foreground">
                            {log.agentName}
                          </span>
                        )}
                        <span>{log.message}</span>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground/50">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div ref={logEndRef} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
