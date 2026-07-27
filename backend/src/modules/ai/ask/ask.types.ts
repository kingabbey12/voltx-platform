import { GroundedRecordRef, ToolGrounding } from '../tools/tool-result.types';

/**
 * The trust registers of docs/design/ASK.md §6 and COMPANY.md §6, in
 * descending confidence: evidence (from outside the company's assertions),
 * record (attested by a person, on the record), opinion (attributed
 * judgment), inference (computed or estimated by Ask — never presentable as
 * fact).
 */
export type TrustRegister = 'evidence' | 'record' | 'opinion' | 'inference';

/** A door: a claim's link to the canonical record it rests on. */
export interface AskDoor {
  /** The exact substring of the segment's text the door underlines. */
  text: string;
  recordType: string;
  recordId: string;
}

/** One sentence-or-paragraph of the answer, register-marked. */
export interface AskSegment {
  register: TrustRegister;
  text: string;
  /** Required when register is 'inference': what the inference is based on. */
  basis?: string;
  doors: AskDoor[];
}

/** An inline answer the owner can choose; recommended renders in Volt, first. */
export interface AskAnswer {
  label: string;
  /** The objective submitted when chosen — a follow-up turn in plain words. */
  objective: string;
  recommended?: boolean;
}

/** The structured response model the Today UI consumes without redesign. */
export interface AskStructuredResponse {
  segments: AskSegment[];
  answers: AskAnswer[];
  /** Follow-up suggestions, rendered as quiet alternates. */
  suggestions: string[];
  /** Approval ids for work held during this turn — the ledger's source. */
  heldApprovalIds: string[];
  /**
   * How many doors were stripped because their record id was not grounded in
   * this turn's tool results — observability for the grounding pipeline.
   */
  ungroundedDoorsRemoved: number;
}

/** Wire events for POST /ai/ask/stream. */
export type AskStreamEvent =
  | { type: 'doing'; label: string }
  | { type: 'sentence'; text: string }
  | { type: 'held'; approvalId: string; toolName: string }
  | { type: 'response'; response: AskStructuredResponse }
  | { type: 'stopped' }
  | { type: 'error'; message: string };

/** The grounding set of one turn: everything tools actually returned. */
export interface TurnGrounding {
  records: GroundedRecordRef[];
  summaries: Array<{ toolName: string; grounding: ToolGrounding }>;
}
