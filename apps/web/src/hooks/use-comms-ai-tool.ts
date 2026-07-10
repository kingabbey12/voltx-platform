"use client";

import { useCallback, useState } from "react";
import { aiApi } from "@/lib/api/ai";

/**
 * Runs a real communications AI tool (comms_summarize_conversation,
 * comms_draft_reply, comms_extract_contact_info) via the same
 * /ai/tools/execute endpoint the Command Center uses — genuine tool
 * execution against the real backend, not a canned response.
 */
export function useCommsAiTool<T = Record<string, unknown>>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (toolName: string, input: Record<string, unknown>) => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const conversation = await aiApi.createConversation({ title: `Comms: ${toolName}` });
      const result = await aiApi.executeTool(conversation.id, toolName, input);
      setData(JSON.parse(result.result.content) as T);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI tool failed");
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, run };
}
