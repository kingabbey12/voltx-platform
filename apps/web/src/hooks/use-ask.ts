"use client";

import { useCallback, useRef, useState } from "react";
import { streamAsk, type AskStructuredResponse } from "@/lib/ai/ask-client";
import { useOperatorSession } from "@/hooks/use-operator";

/**
 * One Ask exchange for the Today screen (docs/design/ASK.md §7): sentences
 * arrive whole, the doing-line names actual work, Esc stops generation and
 * keeps what arrived, and the grounded structured response lands last. A
 * turn that dies before its first event is retried once — past first byte,
 * an interruption surfaces as the honest error grammar instead.
 */

export type AskStatus = "idle" | "asking" | "done" | "stopped" | "error";

export interface AskExchange {
  prompt: string;
  sentences: string[];
  doing: string | null;
  response: AskStructuredResponse | null;
  heldApprovalIds: string[];
  status: AskStatus;
  error: string | null;
}

const IDLE_EXCHANGE: AskExchange = {
  prompt: "",
  sentences: [],
  doing: null,
  response: null,
  heldApprovalIds: [],
  status: "idle",
  error: null,
};

export function useAsk(onHeldWork?: () => void) {
  const { session, ensureSession } = useOperatorSession();
  const [exchange, setExchange] = useState<AskExchange>(IDLE_EXCHANGE);
  const abortRef = useRef<AbortController | null>(null);

  const ask = useCallback(
    async (prompt: string) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setExchange({ ...IDLE_EXCHANGE, prompt, status: "asking" });

      const activeSession = session ?? (await ensureSession());
      if (!activeSession) {
        setExchange((current) => ({
          ...current,
          status: "error",
          error: "the connection to Voltx failed",
        }));
        return;
      }

      let receivedAnything = false;
      let heldSeen = false;
      const attemptStream = async () => {
        for await (const event of streamAsk(
          {
            agentId: activeSession.fullAgentId,
            conversationId: activeSession.conversationId,
            prompt,
          },
          controller.signal,
        )) {
          receivedAnything = true;
          switch (event.type) {
            case "doing":
              setExchange((current) => ({ ...current, doing: event.label }));
              break;
            case "sentence":
              setExchange((current) => ({
                ...current,
                doing: null,
                sentences: [...current.sentences, event.text],
              }));
              break;
            case "held":
              heldSeen = true;
              setExchange((current) => ({
                ...current,
                heldApprovalIds: [...current.heldApprovalIds, event.approvalId],
              }));
              break;
            case "response":
              setExchange((current) => ({
                ...current,
                doing: null,
                response: event.response,
              }));
              break;
            case "stopped":
              setExchange((current) => ({ ...current, doing: null, status: "stopped" }));
              break;
            case "error":
              setExchange((current) => ({
                ...current,
                doing: null,
                status: "error",
                error: event.message,
              }));
              break;
            case "done":
              setExchange((current) =>
                current.status === "asking" ? { ...current, doing: null, status: "done" } : current,
              );
              break;
          }
        }
      };

      try {
        try {
          await attemptStream();
        } catch (error) {
          // Reconnect once, only when the turn died before its first event —
          // re-running a stream that already acted could act twice.
          if (!receivedAnything && !controller.signal.aborted) {
            await attemptStream();
          } else {
            throw error;
          }
        }
        if (heldSeen) onHeldWork?.();
      } catch (error) {
        if (controller.signal.aborted) {
          setExchange((current) => ({ ...current, doing: null, status: "stopped" }));
          return;
        }
        setExchange((current) => ({
          ...current,
          doing: null,
          status: "error",
          error: error instanceof Error ? error.message : "the connection to Voltx failed",
        }));
      }
    },
    [session, ensureSession, onHeldWork],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { exchange, ask, stop };
}
