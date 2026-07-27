import { GroundedRecordRef, ToolGrounding } from './tool-result.types';

/**
 * Factories for the two grounding shapes almost every tool has (Ask
 * pipeline, docs/design/ASK.md §5): reads that return canonical records, and
 * mutations that touch one record and cause one event. Tools with richer
 * results implement ground() by hand; these keep the common cases to a few
 * declarative lines and one vocabulary.
 *
 * The returned functions accept `unknown` output (matching AITool.ground's
 * contravariant parameter) and cast to the tool's known output shape — the
 * same trust the tool's own execute() return already established.
 */

/** Grounds a search/list tool: N records read, no events caused. */
export function searchGrounding<TOutput>(options: {
  recordType: string;
  noun: [singular: string, plural: string];
  items: (output: TOutput) => Array<{ id: string; label: string }>;
  emptySummary?: string;
}): (input: unknown, output: unknown) => ToolGrounding {
  return (_input, output) => {
    const items = options.items(output as TOutput);
    const [singular, plural] = options.noun;
    return {
      summary:
        items.length === 0
          ? (options.emptySummary ?? `No matching ${plural}`)
          : `Read ${items.length} ${items.length === 1 ? singular : plural}`,
      records: items.map(({ id, label }) => ({ type: options.recordType, id, label })),
      events: [],
    };
  };
}

/** Grounds a mutation: one record affected, one resulting event. */
export function mutationGrounding<TOutput>(options: {
  recordType: string;
  /** Past-tense action phrase, e.g. "Created contact" — the event's verb. */
  action: string;
  record: (output: TOutput) => { id: string; label: string };
}): (input: unknown, output: unknown) => ToolGrounding {
  return (_input, output) => {
    const { id, label } = options.record(output as TOutput);
    const record: GroundedRecordRef = { type: options.recordType, id, label };
    return {
      summary: `${options.action} — ${label}`,
      records: [record],
      events: [
        { description: `${options.action}: ${label}`, recordType: record.type, recordId: id },
      ],
    };
  };
}

/** Grounds a pure computation (calculator, datetime…): summary only. */
export function computationGrounding(summary: string): () => ToolGrounding {
  return () => ({ summary, records: [], events: [] });
}
