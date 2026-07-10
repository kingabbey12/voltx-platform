"use client";

import { useCallback, useEffect, useState } from "react";
import { agentsApi } from "@/lib/api/agents";
import { useOperatorSession } from "@/hooks/use-operator";
import { extractFinalText } from "@/lib/ai/extract-final-text";

const BRIEF_OBJECTIVE =
  "Generate today's business brief for the person running this workspace. Search opportunities, overdue activities, and failed workflow runs to ground it in real data. Structure it as: Today's priorities, Deals at risk, Overdue tasks, Workflow failures, Recommended actions. Skip any section with nothing to report. Be concise.";

function cacheKey(organizationId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `voltx.dailyBrief.${organizationId}.${today}`;
}

export function useDailyBrief(organizationId: string | undefined) {
  const { session, ensureSession } = useOperatorSession();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const activeSession = session ?? (await ensureSession());
      if (!activeSession) throw new Error("AI Command Center is unavailable");

      const result = await agentsApi.runAutonomous(activeSession.readOnlyAgentId, {
        conversationId: activeSession.conversationId,
        objective: BRIEF_OBJECTIVE,
        // The brief is a short, skimmable digest, not a full report — cap
        // it well under the Command Center's general tool-call budget.
        maxOutputTokens: 1500,
      });

      const finalText = extractFinalText(result.run.output.outputText);
      setText(finalText);
      window.localStorage.setItem(
        cacheKey(organizationId),
        JSON.stringify({ text: finalText, at: Date.now() }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate today's brief");
    } finally {
      setLoading(false);
    }
  }, [organizationId, session, ensureSession]);

  useEffect(() => {
    if (!organizationId) return;
    const cached = window.localStorage.getItem(cacheKey(organizationId));
    if (cached) {
      try {
        setText((JSON.parse(cached) as { text: string }).text);
        return;
      } catch {
        // Fall through to generating a fresh one.
      }
    }
    void generate();
    // Only re-run when the org (i.e. the cache key's date/org scope) changes — `generate` itself is stable per render but intentionally not re-triggered on every identity change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  return { text, loading, error, regenerate: generate };
}
