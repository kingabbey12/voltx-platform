/**
 * Sentence-level streaming (docs/design/ASK.md §7): tokens go in, complete
 * sentences come out. The Today surface never renders a partial sentence —
 * "sentences arrive whole, settle with the standard fade, at reading pace."
 *
 * Purely incremental and side-effect free: feed push() every delta, drain the
 * returned sentences, and call flush() at end-of-stream for the remainder.
 * Emission stops permanently once the structured-response fence opens — the
 * fenced JSON is machine content and must never stream as prose.
 */
import { ASK_FENCE_OPEN } from './ask-response-contract';

const SENTENCE_BOUNDARY = /([.!?…])(["')\]]*)(\s+|$)/g;

/** Trailing fragments that look like a boundary but are not one. */
const NON_TERMINAL_TAILS = [
  /\b(?:e\.g|i\.e|etc|vs|Mr|Mrs|Ms|Dr|St|No)\.$/i,
  /\b\d+\.$/, // "March 11." could end "March 11. 2pm" — treat digits+dot as ambiguous only when nothing follows yet
];

export class SentenceChunker {
  private buffer = '';
  private fenced = false;

  /** Feed one delta; returns every sentence completed by it. */
  push(delta: string): string[] {
    if (this.fenced) return [];
    this.buffer += delta;

    const fenceIndex = this.buffer.indexOf(ASK_FENCE_OPEN);
    if (fenceIndex >= 0) {
      const before = this.buffer.slice(0, fenceIndex);
      this.buffer = '';
      this.fenced = true;
      const trimmed = before.trim();
      return trimmed.length > 0 ? splitCompleted(trimmed, true).sentences : [];
    }

    // Hold the tail back if it might be the start of the fence marker, so a
    // fence split across deltas can never leak as prose.
    const holdback = fenceHoldback(this.buffer);
    const scannable = this.buffer.slice(0, this.buffer.length - holdback);

    const { sentences, remainder } = splitCompleted(scannable, false);
    this.buffer = remainder + this.buffer.slice(this.buffer.length - holdback);
    return sentences;
  }

  /** End of stream: whatever remains is one final (possibly unterminated) sentence. */
  flush(): string[] {
    if (this.fenced) return [];
    const remainder = this.buffer.trim();
    this.buffer = '';
    return remainder.length > 0 ? [remainder] : [];
  }
}

function splitCompleted(
  text: string,
  flushAll: boolean,
): { sentences: string[]; remainder: string } {
  const sentences: string[] = [];
  let cursor = 0;

  SENTENCE_BOUNDARY.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_BOUNDARY.exec(text)) !== null) {
    const end = match.index + match[1].length + match[2].length;
    const candidate = text.slice(cursor, end).trim();
    if (candidate.length === 0) {
      cursor = end;
      continue;
    }
    // A boundary at the very end of the buffer is only trusted when flushing —
    // more text may still arrive and reveal an abbreviation or a decimal.
    const atBufferEnd = SENTENCE_BOUNDARY.lastIndex >= text.length;
    if (!flushAll && atBufferEnd) break;
    if (NON_TERMINAL_TAILS.some((pattern) => pattern.test(candidate)) && !flushAll) {
      continue;
    }
    sentences.push(candidate);
    cursor = end;
  }

  if (flushAll) {
    const tail = text.slice(cursor).trim();
    if (tail.length > 0) sentences.push(tail);
    return { sentences, remainder: '' };
  }

  return { sentences, remainder: text.slice(cursor) };
}

/** Length of the buffer tail that could be a prefix of the fence marker. */
function fenceHoldback(buffer: string): number {
  const max = Math.min(buffer.length, ASK_FENCE_OPEN.length - 1);
  for (let candidate = max; candidate > 0; candidate -= 1) {
    if (ASK_FENCE_OPEN.startsWith(buffer.slice(buffer.length - candidate))) {
      return candidate;
    }
  }
  return 0;
}
