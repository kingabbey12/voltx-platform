export interface ToolResult {
  toolName: string;
  content: string;
  isError?: boolean;
}

/**
 * A reference to a canonical record touched or returned by a tool — the
 * grounding unit of the Ask pipeline (docs/design/ASK.md §8, COMPANY.md §5).
 * `type` is a namespaced record kind (e.g. "sales.opportunity") and `id` the
 * record's immutable identifier; together they resolve through the record
 * resolver to exactly one canonical owner.
 */
export interface GroundedRecordRef {
  type: string;
  id: string;
  label: string;
}

/** An event a tool's execution caused (a record created, a message sent). */
export interface GroundedEventRef {
  description: string;
  recordType?: string;
  recordId?: string;
}

/**
 * The grounding envelope a tool may attach to its result: an owner-facing
 * summary (the frontend never invents summaries), the canonical records the
 * result rests on, and the events the execution caused. Tools that do not
 * implement grounding yield `null` — absence is honest and rendered as such.
 */
export interface ToolGrounding {
  summary: string;
  records: GroundedRecordRef[];
  events: GroundedEventRef[];
}
