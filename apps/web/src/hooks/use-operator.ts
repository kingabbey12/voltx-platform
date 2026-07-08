"use client";

import { useCallback, useRef, useState } from "react";
import { operatorApi } from "@/lib/api/operator";
import { streamSse } from "@/lib/ai/sse-client";
import { parseAgentStreamEvent } from "@/lib/ai/stream-events";
import { useOperatorStore, type CommandTurn } from "@/lib/stores/operator-store";
import { useWorkspaceContext } from "@/lib/ai/context-engine";
import { extractStreamingFinalAnswer } from "@/lib/ai/extract-final-text";

// Module-level, not per-hook-instance: the Daily Brief widget and the
// Command Center each call ensureSession() independently, often within the
// same render pass before either's state update lands. Without sharing the
// in-flight promise across all callers, both see session === null and both
// POST /ai/operator/session concurrently — which races on the backend's
// per-organization unique agent name constraint. Mirrors the refreshPromise
// dedup pattern in lib/api/client.ts.
let sessionPromise: ReturnType<typeof operatorApi.createSession> | null = null;

export function useOperatorSession() {
  const session = useOperatorStore((state) => state.session);
  const setSession = useOperatorStore((state) => state.setSession);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ensureSession = useCallback(async () => {
    if (session) return session;
    setLoading(true);
    setError(null);
    try {
      sessionPromise ??= operatorApi.createSession();
      const created = await sessionPromise;
      setSession(created);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI Command Center is unavailable");
      return null;
    } finally {
      sessionPromise = null;
      setLoading(false);
    }
  }, [session, setSession]);

  return { session, ensureSession, loading, error };
}

export function useRunCommand() {
  const { session, ensureSession } = useOperatorSession();
  const allowActions = useOperatorStore((state) => state.allowActions);
  const startTurn = useOperatorStore((state) => state.startTurn);
  const appendEvent = useOperatorStore((state) => state.appendEvent);
  const finishTurn = useOperatorStore((state) => state.finishTurn);
  const workspaceContext = useWorkspaceContext();
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (objective: string) => {
      const activeSession = session ?? (await ensureSession());
      if (!activeSession) return;

      const agentId = allowActions ? activeSession.fullAgentId : activeSession.readOnlyAgentId;
      const turnId = crypto.randomUUID();

      const turn: CommandTurn = {
        id: turnId,
        objective,
        agentId,
        agentRunId: null,
        allowedActions: allowActions,
        status: "running",
        events: [],
        finalText: null,
        toolCalls: [],
        error: null,
        createdAt: Date.now(),
      };
      startTurn(turn);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        for await (const frame of streamSse(
          `/ai/agents/${agentId}/run/autonomous/stream`,
          { conversationId: activeSession.conversationId, objective, workspaceContext },
          controller.signal,
        )) {
          const event = parseAgentStreamEvent(frame.event, frame.data);
          if (!event) continue;

          appendEvent(turnId, event);

          if (event.type === "coordinator_started") {
            finishTurn(turnId, { agentRunId: event.rootRunId });
          } else if (event.type === "error") {
            finishTurn(turnId, { status: "error", error: event.message });
          } else if (event.type === "message_end" && event.outputText) {
            const finalAnswer = extractStreamingFinalAnswer(event.outputText);
            if (finalAnswer !== null) {
              finishTurn(turnId, { finalText: finalAnswer });
            }
          } else if (event.type === "done") {
            finishTurn(turnId, { status: "done" });
          }
        }
      } catch (err) {
        finishTurn(turnId, {
          status: "error",
          error: err instanceof Error ? err.message : "Command failed",
        });
      }
    },
    [session, ensureSession, allowActions, startTurn, appendEvent, finishTurn, workspaceContext],
  );

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { run, cancel };
}
