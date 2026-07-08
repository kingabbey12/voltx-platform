"use client";

import { useCallback, useState } from "react";
import { aiApi } from "@/lib/api/ai";

/**
 * One-shot AI Copilot ask: creates a small throwaway conversation, sends a
 * single message with workspace context, returns the assistant's reply.
 * Distinct from the Command Center (multi-turn, tool-calling, persisted
 * turns) — Copilot actions are page-scoped Q&A, not agent runs.
 */
export function useCopilotAsk() {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = useCallback(async (title: string, prompt: string, workspaceContext: string[]) => {
    setLoading(true);
    setError(null);
    setText(null);
    try {
      const conversation = await aiApi.createConversation({ title });
      const result = await aiApi.sendMessage(conversation.id, prompt, workspaceContext);
      setText(result.assistantMessage?.content ?? "No response.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "The AI couldn't respond right now.");
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setText(null);
    setError(null);
  }, []);

  return { text, loading, error, ask, reset };
}
