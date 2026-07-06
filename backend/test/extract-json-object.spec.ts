import { extractJsonObject } from '../src/modules/ai/agents/autonomous/extract-json-object';

describe('extractJsonObject', () => {
  it('parses a plain JSON object', () => {
    expect(extractJsonObject('{"a": 1, "b": "two"}')).toEqual({ a: 1, b: 'two' });
  });

  it('extracts JSON from inside a markdown code fence', () => {
    expect(extractJsonObject('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('extracts the first balanced object even with surrounding prose', () => {
    expect(extractJsonObject('here you go: {"a": 1} thanks')).toEqual({ a: 1 });
  });

  it('correctly balances nested objects', () => {
    expect(extractJsonObject('{"a": {"b": {"c": 1}}}')).toEqual({ a: { b: { c: 1 } } });
  });

  it('ignores braces inside string values when balancing', () => {
    expect(extractJsonObject('{"a": "text with a } brace"}')).toEqual({
      a: 'text with a } brace',
    });
  });

  it('returns null for a JSON array (not an object)', () => {
    expect(extractJsonObject('[1, 2, 3]')).toBeNull();
  });

  it('returns null when there is no JSON at all', () => {
    expect(extractJsonObject('just plain text')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(extractJsonObject('{"a": }')).toBeNull();
  });

  it('returns null for an unterminated object', () => {
    expect(extractJsonObject('{"a": 1')).toBeNull();
  });
});
