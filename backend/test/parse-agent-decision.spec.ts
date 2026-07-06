import { parseAgentDecision } from '../src/modules/ai/agents/autonomous/parse-agent-decision';

describe('parseAgentDecision', () => {
  it('parses a well-formed tool_call decision', () => {
    const decision = parseAgentDecision(
      JSON.stringify({
        thought: 'I need the current time.',
        action: 'tool_call',
        toolName: 'datetime',
        input: { timezone: 'UTC' },
      }),
    );

    expect(decision).toEqual({
      kind: 'tool_call',
      thought: 'I need the current time.',
      toolName: 'datetime',
      input: { timezone: 'UTC' },
    });
  });

  it('parses a well-formed final_answer decision', () => {
    const decision = parseAgentDecision(
      JSON.stringify({
        thought: 'I have everything I need.',
        action: 'final_answer',
        content: 'The current time is 10:00 UTC.',
      }),
    );

    expect(decision).toEqual({
      kind: 'final_answer',
      thought: 'I have everything I need.',
      content: 'The current time is 10:00 UTC.',
    });
  });

  it('extracts JSON wrapped in a markdown code fence', () => {
    const raw = [
      'Sure, here is my decision:',
      '```json',
      JSON.stringify({ action: 'tool_call', toolName: 'calculator', input: { expression: '1+1' } }),
      '```',
    ].join('\n');

    const decision = parseAgentDecision(raw);

    expect(decision).toEqual({
      kind: 'tool_call',
      thought: '',
      toolName: 'calculator',
      input: { expression: '1+1' },
    });
  });

  it('extracts JSON preceded and followed by prose', () => {
    const raw = `Let me think about this. ${JSON.stringify({
      action: 'final_answer',
      content: 'Done.',
    })} That should do it.`;

    const decision = parseAgentDecision(raw);

    expect(decision.kind).toBe('final_answer');
    expect((decision as { content: string }).content).toBe('Done.');
  });

  it('treats a tool_call missing a toolName as a final answer using the raw text', () => {
    const raw = JSON.stringify({ action: 'tool_call', input: {} });

    const decision = parseAgentDecision(raw);

    expect(decision.kind).toBe('final_answer');
  });

  it('defaults a tool_call with a missing input object to an empty object', () => {
    const decision = parseAgentDecision(JSON.stringify({ action: 'tool_call', toolName: 'uuid' }));

    expect(decision).toEqual({ kind: 'tool_call', thought: '', toolName: 'uuid', input: {} });
  });

  it('falls back to a final answer using the raw text when the output is not JSON at all', () => {
    const decision = parseAgentDecision('The final answer is 42.');

    expect(decision).toEqual({
      kind: 'final_answer',
      thought: '',
      content: 'The final answer is 42.',
    });
  });

  it('falls back to a placeholder final answer when the output is empty', () => {
    const decision = parseAgentDecision('   ');

    expect(decision).toEqual({
      kind: 'final_answer',
      thought: '',
      content: 'No response was generated.',
    });
  });

  it('never throws on malformed JSON', () => {
    expect(() => parseAgentDecision('{ action: "tool_call", toolName: unquoted }')).not.toThrow();
  });

  it('parses a well-formed delegate decision', () => {
    const decision = parseAgentDecision(
      JSON.stringify({
        thought: 'Sales needs to weigh in.',
        action: 'delegate',
        agentName: 'Sales Assistant',
        objective: 'Summarize this quarter pipeline risk.',
      }),
    );

    expect(decision).toEqual({
      kind: 'delegate',
      thought: 'Sales needs to weigh in.',
      agentName: 'Sales Assistant',
      objective: 'Summarize this quarter pipeline risk.',
    });
  });

  it('treats a delegate decision missing an objective as a final answer', () => {
    const decision = parseAgentDecision(
      JSON.stringify({ action: 'delegate', agentName: 'Sales Assistant' }),
    );

    expect(decision.kind).toBe('final_answer');
  });

  it('parses a well-formed delegate_parallel decision', () => {
    const decision = parseAgentDecision(
      JSON.stringify({
        action: 'delegate_parallel',
        delegations: [
          { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
          { agentName: 'Customer Support', objective: 'Summarize open tickets.' },
        ],
      }),
    );

    expect(decision).toEqual({
      kind: 'delegate_parallel',
      thought: '',
      delegations: [
        { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
        { agentName: 'Customer Support', objective: 'Summarize open tickets.' },
      ],
    });
  });

  it('filters out malformed entries within a delegate_parallel list', () => {
    const decision = parseAgentDecision(
      JSON.stringify({
        action: 'delegate_parallel',
        delegations: [
          { agentName: 'Sales Assistant', objective: 'Summarize pipeline.' },
          { agentName: 'Missing Objective' },
          'not even an object',
        ],
      }),
    );

    expect(decision).toEqual({
      kind: 'delegate_parallel',
      thought: '',
      delegations: [{ agentName: 'Sales Assistant', objective: 'Summarize pipeline.' }],
    });
  });

  it('treats a delegate_parallel decision with no valid entries as a final answer', () => {
    const decision = parseAgentDecision(
      JSON.stringify({ action: 'delegate_parallel', delegations: [{ agentName: 'x' }] }),
    );

    expect(decision.kind).toBe('final_answer');
  });
});
