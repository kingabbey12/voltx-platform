"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { agentsApi } from "@/lib/api/agents";
import { useOperatorSession } from "@/hooks/use-operator";
import { extractFinalText } from "@/lib/ai/extract-final-text";

/**
 * The morning brief for the Today screen, in the letter voice the Today spec
 * freezes: short prose paragraphs in one voice, grounded in real data, no
 * headings, no bullets. Mirrors the session/caching mechanics of
 * use-daily-brief (the legacy dashboard widget) but produces the letter, not
 * the sectioned digest.
 */
const BRIEF_OBJECTIVE = [
  "Write this morning's brief for the owner of this workspace, as a short letter in one voice.",
  "Ground every sentence in real data first: search opportunities, overdue activities, and recent workflow runs.",
  "Two or three short paragraphs of plain prose. No headings, no bullet points, no markdown, no lists.",
  "Lead with what changed and what was handled. If something needs the owner's attention, end with it.",
  "If nothing needs them, write exactly one sentence beginning: 'Nothing needs you today.'",
  "Never invent facts. Omit anything you cannot see.",
].join(" ");

function cacheKey(organizationId: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `voltx.today.brief.${organizationId}.${today}`;
}

/** Split the model's letter into paragraphs, stripping any stray markdown
 * it produced despite instructions — the screen renders prose only. */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}|\r\n{2,}/)
    .map((paragraph) =>
      paragraph
        .replace(/^[#>*-]+\s*/gm, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\s*\n\s*/g, " ")
        .trim(),
    )
    .filter((paragraph) => paragraph.length > 0);
}

export interface TodayBrief {
  paragraphs: string[] | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

export function useTodayBrief(organizationId: string | undefined): TodayBrief {
  const { session, ensureSession } = useOperatorSession();
  const [paragraphs, setParagraphs] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startedFor = useRef<string | null>(null);

  const generate = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    setError(null);
    try {
      const activeSession = session ?? (await ensureSession());
      if (!activeSession) throw new Error("the connection to Voltx failed");

      const result = await agentsApi.runAutonomous(activeSession.readOnlyAgentId, {
        conversationId: activeSession.conversationId,
        objective: BRIEF_OBJECTIVE,
        maxOutputTokens: 1000,
      });

      const text = extractFinalText(result.run.output.outputText);
      const parts = toParagraphs(text);
      setParagraphs(parts);
      window.localStorage.setItem(
        cacheKey(organizationId),
        JSON.stringify({ paragraphs: parts, at: Date.now() }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "the connection to Voltx failed");
    } finally {
      setLoading(false);
    }
  }, [organizationId, session, ensureSession]);

  useEffect(() => {
    if (!organizationId) return;
    // One generation per org per mount; the day-scoped cache handles the rest.
    if (startedFor.current === organizationId) return;
    startedFor.current = organizationId;

    const cached = window.localStorage.getItem(cacheKey(organizationId));
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { paragraphs: string[] };
        if (Array.isArray(parsed.paragraphs) && parsed.paragraphs.length > 0) {
          setParagraphs(parsed.paragraphs);
          return;
        }
      } catch {
        // Corrupt cache — regenerate.
      }
    }
    void generate();
  }, [organizationId, generate]);

  return { paragraphs, loading, error, retry: generate };
}
