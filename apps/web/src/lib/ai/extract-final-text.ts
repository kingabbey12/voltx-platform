/**
 * The autonomous agent loop's raw model output is a ReAct-style JSON
 * envelope (`{"thought": "...", "action": "final_answer", "content": ...}`)
 * rather than plain prose — this pulls out just `content` for display,
 * falling back to the raw text if it isn't in that shape.
 */
export function extractFinalText(rawOutputText: string | undefined): string {
  if (!rawOutputText) return "";
  try {
    const parsed = JSON.parse(rawOutputText) as { content?: unknown };
    if (parsed && typeof parsed === "object" && "content" in parsed) {
      const content = parsed.content;
      if (typeof content === "string") return content;
      if (Array.isArray(content)) {
        return content
          .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
          .join("\n");
      }
      if (content && typeof content === "object") return JSON.stringify(content, null, 2);
    }
  } catch {
    // Not JSON — the model returned plain text, which is already what we want.
  }
  return rawOutputText;
}

/**
 * For streaming runs: a `message_end` fires once per reasoning iteration,
 * not just at the true end — an iteration that decides to call a tool
 * emits one too, with `action: "tool_call"` in its raw JSON. Rendering
 * that as if it were the answer shows the user raw model-internals JSON.
 * Only accept text from an iteration whose decision was actually
 * `final_answer`; every other shape returns null so the caller keeps
 * showing its running/thinking state instead.
 */
export function extractStreamingFinalAnswer(rawOutputText: string | undefined): string | null {
  if (!rawOutputText) return null;
  try {
    const parsed = JSON.parse(rawOutputText) as { action?: string };
    if (parsed?.action !== "final_answer") return null;
  } catch {
    // Not JSON at all — treat as genuine final prose.
  }
  return extractFinalText(rawOutputText);
}
