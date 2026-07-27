import { GroundedRecordRef } from '../tools/tool-result.types';
import { ASK_FENCE_CLOSE, ASK_FENCE_OPEN } from './ask-response-contract';
import { AskDoor, AskSegment, AskStructuredResponse, TrustRegister } from './ask.types';

/**
 * Parses and grounds the model's output for one Ask turn.
 *
 * Grounding is enforced here, not requested politely in the prompt: a door
 * whose record id was not returned by a tool in this turn is stripped, and a
 * segment claiming the 'record' or 'evidence' register without a single
 * surviving door is demoted to 'inference'. Inference is never presented as
 * fact; ungrounded claims are never presented as records. When the model
 * ignores the contract entirely, the prose degrades to inference-register
 * segments — degraded, but never wrong about its own confidence.
 */

const REGISTERS: readonly TrustRegister[] = ['evidence', 'record', 'opinion', 'inference'];

export interface ParsedAskOutput {
  prose: string;
  structured: AskStructuredResponse;
}

export function parseAndGroundAskOutput(
  outputText: string,
  groundedRecords: GroundedRecordRef[],
  heldApprovalIds: string[],
): ParsedAskOutput {
  const { prose, fencedJson } = splitProseAndFence(outputText);
  const groundedIds = new Set(groundedRecords.map((record) => `${record.type}:${record.id}`));

  const raw = fencedJson ? tryParseJson(fencedJson) : null;
  if (!raw) {
    return {
      prose,
      structured: {
        segments: proseToInferenceSegments(prose),
        answers: [],
        suggestions: [],
        heldApprovalIds,
        ungroundedDoorsRemoved: 0,
      },
    };
  }

  let removedDoors = 0;
  const segments: AskSegment[] = toArray(raw.segments)
    .map((entry) => normalizeSegment(entry))
    .filter((segment): segment is AskSegment => segment !== null)
    .map((segment) => {
      const doors = segment.doors.filter((door) =>
        groundedIds.has(`${door.recordType}:${door.recordId}`),
      );
      removedDoors += segment.doors.length - doors.length;

      // The registers that claim grounding must show it: a 'record' or
      // 'evidence' segment with no surviving door is demoted to inference.
      const claimsGrounding = segment.register === 'record' || segment.register === 'evidence';
      const register: TrustRegister =
        claimsGrounding && doors.length === 0 ? 'inference' : segment.register;

      return { ...segment, register, doors };
    });

  const answers = toArray(raw.answers)
    .map((entry) => normalizeAnswer(entry))
    .filter((answer): answer is NonNullable<typeof answer> => answer !== null);
  // At most one recommendation, and it leads — position is part of the register.
  let seenRecommended = false;
  const orderedAnswers = answers
    .map((answer) => {
      if (!answer.recommended) return answer;
      if (seenRecommended) return { ...answer, recommended: false };
      seenRecommended = true;
      return answer;
    })
    .sort((a, b) => Number(b.recommended ?? false) - Number(a.recommended ?? false));

  const suggestions = toArray(raw.suggestions)
    .filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
    .map((entry) => entry.trim())
    .slice(0, 3);

  return {
    prose,
    structured: {
      segments: segments.length > 0 ? segments : proseToInferenceSegments(prose),
      answers: orderedAnswers.slice(0, 4),
      suggestions,
      heldApprovalIds,
      ungroundedDoorsRemoved: removedDoors,
    },
  };
}

export function splitProseAndFence(outputText: string): {
  prose: string;
  fencedJson: string | null;
} {
  const fenceStart = outputText.indexOf(ASK_FENCE_OPEN);
  if (fenceStart < 0) {
    return { prose: outputText.trim(), fencedJson: null };
  }
  const afterOpen = fenceStart + ASK_FENCE_OPEN.length;
  const fenceEnd = outputText.indexOf(ASK_FENCE_CLOSE, afterOpen);
  const body = fenceEnd >= 0 ? outputText.slice(afterOpen, fenceEnd) : outputText.slice(afterOpen);
  return { prose: outputText.slice(0, fenceStart).trim(), fencedJson: body.trim() };
}

function tryParseJson(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function toArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeSegment(entry: unknown): AskSegment | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const record = entry as Record<string, unknown>;
  const text = typeof record.text === 'string' ? record.text.trim() : '';
  if (text.length === 0) return null;

  const register = REGISTERS.includes(record.register as TrustRegister)
    ? (record.register as TrustRegister)
    : 'inference';
  const basis = typeof record.basis === 'string' ? record.basis.trim() : undefined;

  const doors: AskDoor[] = toArray(record.doors)
    .map((door) => {
      if (typeof door !== 'object' || door === null) return null;
      const doorRecord = door as Record<string, unknown>;
      if (
        typeof doorRecord.text !== 'string' ||
        typeof doorRecord.recordType !== 'string' ||
        typeof doorRecord.recordId !== 'string'
      ) {
        return null;
      }
      return {
        text: doorRecord.text,
        recordType: doorRecord.recordType,
        recordId: doorRecord.recordId,
      };
    })
    .filter((door): door is AskDoor => door !== null);

  return { register, text, ...(basis ? { basis } : {}), doors };
}

function normalizeAnswer(
  entry: unknown,
): { label: string; objective: string; recommended?: boolean } | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const record = entry as Record<string, unknown>;
  const label = typeof record.label === 'string' ? record.label.trim() : '';
  const objective = typeof record.objective === 'string' ? record.objective.trim() : '';
  if (label.length === 0 || objective.length === 0) return null;
  return {
    label,
    objective,
    ...(record.recommended === true ? { recommended: true } : {}),
  };
}

function proseToInferenceSegments(prose: string): AskSegment[] {
  return prose
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => ({ register: 'inference' as const, text: paragraph, doors: [] }));
}
