/**
 * The belief layer of memory (docs/design/ASK.md §4/§5, COMPANY.md §4/§7):
 * every remembered fact carries a confidence, the records that justify it,
 * and when it was last confirmed or contradicted. Beliefs are inspectable
 * and correctable, are rebuildable from conversations, and are never
 * evidence — they live in the Memory row's metadata extension point, typed
 * and versioned here rather than schema-migrated, so the model stays
 * rebuildable data, not structure.
 */

export interface MemoryBelief {
  /** 0..1 — how firmly the company holds this belief. */
  confidence: number;
  /** Canonical record refs ("type:id") that justify the belief. */
  sourceRecordIds: string[];
  lastConfirmedAt: string | null;
  lastContradictedAt: string | null;
}

const BELIEF_KEY = 'belief';
const CONFIRM_STEP = 0.15;
const CONTRADICT_STEP = 0.3;

export function readBelief(metadata: Record<string, unknown>, importance: number): MemoryBelief {
  const raw = metadata[BELIEF_KEY];
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    return {
      confidence: clamp01(typeof record.confidence === 'number' ? record.confidence : importance),
      sourceRecordIds: Array.isArray(record.sourceRecordIds)
        ? record.sourceRecordIds.filter((id): id is string => typeof id === 'string')
        : [],
      lastConfirmedAt: typeof record.lastConfirmedAt === 'string' ? record.lastConfirmedAt : null,
      lastContradictedAt:
        typeof record.lastContradictedAt === 'string' ? record.lastContradictedAt : null,
    };
  }
  // A memory captured before the belief layer: confidence starts at its
  // capture importance, with no confirmations and no sources on record.
  return {
    confidence: clamp01(importance),
    sourceRecordIds: [],
    lastConfirmedAt: null,
    lastContradictedAt: null,
  };
}

export function confirmBelief(belief: MemoryBelief, now: Date = new Date()): MemoryBelief {
  return {
    ...belief,
    confidence: clamp01(belief.confidence + CONFIRM_STEP),
    lastConfirmedAt: now.toISOString(),
  };
}

export function contradictBelief(belief: MemoryBelief, now: Date = new Date()): MemoryBelief {
  return {
    ...belief,
    confidence: clamp01(belief.confidence - CONTRADICT_STEP),
    lastContradictedAt: now.toISOString(),
  };
}

export function writeBelief(
  metadata: Record<string, unknown>,
  belief: MemoryBelief,
): Record<string, unknown> {
  return { ...metadata, [BELIEF_KEY]: { ...belief } };
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
