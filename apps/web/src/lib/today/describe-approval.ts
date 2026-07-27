import type { AgentApproval } from "@/lib/api/agents";

/**
 * Held-work presentation for an agent approval. The sentence is the
 * server-written summary (stored on the approval at creation from the tool's
 * grounding vocabulary) — the frontend never invents summaries. The verb is
 * an action word derived from the tool's name: labeling, not summarizing.
 */

const VERB_BY_PREFIX: Record<string, string> = {
  send: "Send",
  create: "Create",
  update: "Update",
  schedule: "Schedule",
  post: "Post",
  delete: "Remove",
};

export interface HeldWorkDescription {
  sentence: string;
  verb: string;
}

export function describeApproval(approval: AgentApproval): HeldWorkDescription {
  const prefix = approval.toolName.split(/[_-]/)[0]?.toLowerCase() ?? "";
  const verb = VERB_BY_PREFIX[prefix] ?? "Approve";

  const sentence =
    approval.summary && approval.summary.trim().length > 0
      ? approval.summary.trim()
      : `${humanizeToolName(approval.toolName)} — prepared and awaiting your word`;

  return { sentence, verb };
}

function humanizeToolName(toolName: string): string {
  const words = toolName.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
