import {
  parseAndGroundAskOutput,
  splitProseAndFence,
} from '../src/modules/ai/ask/ask-response.parser';
import { ASK_FENCE_OPEN } from '../src/modules/ai/ask/ask-response-contract';
import { GroundedRecordRef } from '../src/modules/ai/tools/tool-result.types';

const OPPORTUNITY: GroundedRecordRef = {
  type: 'sales.opportunity',
  id: '11111111-1111-1111-1111-111111111111',
  label: 'Hotel Marlin — two machines',
};

function output(prose: string, fenced?: unknown): string {
  if (fenced === undefined) return prose;
  return `${prose}\n${ASK_FENCE_OPEN}\n${JSON.stringify(fenced)}\n\`\`\``;
}

describe('splitProseAndFence', () => {
  it('separates prose from the fenced block', () => {
    const { prose, fencedJson } = splitProseAndFence(output('The answer.', { segments: [] }));
    expect(prose).toBe('The answer.');
    expect(fencedJson).toBe('{"segments":[]}');
  });

  it('treats missing fence as prose only', () => {
    expect(splitProseAndFence('Just words.')).toEqual({
      prose: 'Just words.',
      fencedJson: null,
    });
  });
});

describe('parseAndGroundAskOutput', () => {
  it('keeps doors whose record ids were returned by tools this turn', () => {
    const { structured } = parseAndGroundAskOutput(
      output('Hotel Marlin confirmed.', {
        segments: [
          {
            register: 'record',
            text: 'Hotel Marlin confirmed.',
            doors: [
              { text: 'Hotel Marlin', recordType: OPPORTUNITY.type, recordId: OPPORTUNITY.id },
            ],
          },
        ],
        answers: [],
        suggestions: [],
      }),
      [OPPORTUNITY],
      [],
    );

    expect(structured.segments).toHaveLength(1);
    expect(structured.segments[0].register).toBe('record');
    expect(structured.segments[0].doors).toHaveLength(1);
    expect(structured.ungroundedDoorsRemoved).toBe(0);
  });

  it('strips ungrounded doors and demotes the record claim to inference', () => {
    const { structured } = parseAndGroundAskOutput(
      output('Revenue was 4.2m.', {
        segments: [
          {
            register: 'record',
            text: 'Revenue was 4.2m.',
            doors: [
              {
                text: '4.2m',
                recordType: 'sales.opportunity',
                recordId: '99999999-9999-9999-9999-999999999999',
              },
            ],
          },
        ],
      }),
      [OPPORTUNITY],
      [],
    );

    expect(structured.segments[0].register).toBe('inference');
    expect(structured.segments[0].doors).toHaveLength(0);
    expect(structured.ungroundedDoorsRemoved).toBe(1);
  });

  it('demotes a doorless record claim — grounding must be shown, not asserted', () => {
    const { structured } = parseAndGroundAskOutput(
      output('It is a fact.', {
        segments: [{ register: 'record', text: 'It is a fact.', doors: [] }],
      }),
      [OPPORTUNITY],
      [],
    );
    expect(structured.segments[0].register).toBe('inference');
  });

  it('degrades to inference-register prose when the model ignores the contract', () => {
    const { structured } = parseAndGroundAskOutput('First paragraph.\n\nSecond one.', [], []);
    expect(structured.segments.map((segment) => segment.register)).toEqual([
      'inference',
      'inference',
    ]);
    expect(structured.answers).toEqual([]);
  });

  it('keeps at most one recommended answer and puts it first', () => {
    const { structured } = parseAndGroundAskOutput(
      output('Answer.', {
        segments: [{ register: 'opinion', text: 'Answer.', doors: [] }],
        answers: [
          { label: 'Wait', objective: 'wait a week' },
          { label: 'Draft it', objective: 'draft a check-in', recommended: true },
          { label: 'Also rec', objective: 'other', recommended: true },
        ],
      }),
      [],
      [],
    );

    expect(structured.answers[0]).toEqual({
      label: 'Draft it',
      objective: 'draft a check-in',
      recommended: true,
    });
    expect(structured.answers.filter((answer) => answer.recommended)).toHaveLength(1);
  });

  it('carries held approval ids through to the structured response', () => {
    const { structured } = parseAndGroundAskOutput('Done.', [], ['approval-1']);
    expect(structured.heldApprovalIds).toEqual(['approval-1']);
  });

  it('never throws on malformed fenced JSON', () => {
    const { structured } = parseAndGroundAskOutput(
      `Prose.\n${ASK_FENCE_OPEN}\n{not json\n\`\`\``,
      [],
      [],
    );
    expect(structured.segments[0].register).toBe('inference');
  });
});
