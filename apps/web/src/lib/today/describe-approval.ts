import type { AgentApproval } from "@/lib/api/agents";

/**
 * Turns an agent approval into a held-work sentence and its one verb, per the
 * Today spec: "held work as a ruled ledger of prepared sentences — each
 * awaiting one word." The sentence is assembled from what the approval
 * actually contains; nothing is invented, and unknown tools fall back to an
 * honest generic form.
 */

const VERB_BY_PREFIX: Record<string, string> = {
  send: "Send",
  create: "Create",
  update: "Update",
  schedule: "Schedule",
  post: "Post",
  delete: "Remove",
};

/** Input fields worth surfacing in the sentence, in priority order. */
const SUMMARY_FIELDS = [
  "subject",
  "title",
  "name",
  "summary",
  "description",
  "to",
  "recipient",
  "email",
] as const;

const MAX_SENTENCE_LENGTH = 90;

function humanizeToolName(toolName: string): string {
  const words = toolName.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function summarizeInput(input: Record<string, unknown>): string | null {
  for (const field of SUMMARY_FIELDS) {
    const value = input[field];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

export interface HeldWorkDescription {
  sentence: string;
  verb: string;
}

export function describeApproval(approval: AgentApproval): HeldWorkDescription {
  const prefix = approval.toolName.split(/[_-]/)[0]?.toLowerCase() ?? "";
  const verb = VERB_BY_PREFIX[prefix] ?? "Approve";

  const base = humanizeToolName(approval.toolName);
  const summary = summarizeInput(approval.input);
  const sentence = summary ? `${base} — ${summary}` : `${base} — prepared and awaiting your word`;

  return {
    sentence:
      sentence.length > MAX_SENTENCE_LENGTH
        ? `${sentence.slice(0, MAX_SENTENCE_LENGTH - 1).trimEnd()}…`
        : sentence,
    verb,
  };
}
