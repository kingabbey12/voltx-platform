/**
 * Backend fallback describer for held work: turns a tool call into an
 * owner-facing sentence from its input alone, used when the tool has no
 * describe() of its own. Lives server-side on purpose — the frontend renders
 * stored summaries and never invents them (docs/design/ASK.md §5).
 */

/** Input fields worth surfacing, in priority order. */
const SUMMARY_FIELDS = [
  'subject',
  'title',
  'name',
  'fileName',
  'summary',
  'description',
  'body',
  'note',
  'to',
  'recipient',
  'email',
] as const;

const MAX_LENGTH = 120;

export function describeToolCall(toolName: string, input: Record<string, unknown>): string {
  const base = humanizeToolName(toolName);
  const detail = firstStringField(input);
  const sentence = detail ? `${base} — ${detail}` : `${base} — prepared and awaiting your approval`;
  return sentence.length > MAX_LENGTH
    ? `${sentence.slice(0, MAX_LENGTH - 1).trimEnd()}…`
    : sentence;
}

function humanizeToolName(toolName: string): string {
  const words = toolName.replace(/[_-]+/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function firstStringField(input: Record<string, unknown>): string | null {
  for (const field of SUMMARY_FIELDS) {
    const value = input[field];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}
