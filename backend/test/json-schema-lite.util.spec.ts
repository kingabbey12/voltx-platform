import { validateAgainstJsonSchema } from '../src/modules/extensions/utils/json-schema-lite.util';

describe('validateAgainstJsonSchema', () => {
  it('accepts a value matching a simple object schema', () => {
    const errors = validateAgainstJsonSchema(
      { name: 'Acme', count: 3 },
      {
        type: 'object',
        required: ['name'],
        properties: { name: { type: 'string' }, count: { type: 'number' } },
      },
    );
    expect(errors).toEqual([]);
  });

  it('reports a missing required property', () => {
    const errors = validateAgainstJsonSchema(
      { count: 3 },
      { type: 'object', required: ['name'], properties: { name: { type: 'string' } } },
    );
    expect(errors).toEqual(['$.name is required']);
  });

  it('reports a type mismatch on the top-level value', () => {
    const errors = validateAgainstJsonSchema('not an object', { type: 'object' });
    expect(errors).toEqual(['$: expected object, got string']);
  });

  it('reports a type mismatch on a nested property', () => {
    const errors = validateAgainstJsonSchema(
      { count: 'three' },
      { type: 'object', properties: { count: { type: 'number' } } },
    );
    expect(errors).toEqual(['$.count: expected number, got string']);
  });

  it('validates integer as a stricter subset of number', () => {
    expect(validateAgainstJsonSchema(3, { type: 'integer' })).toEqual([]);
    expect(validateAgainstJsonSchema(3.5, { type: 'integer' })).toEqual([
      '$: expected integer, got number',
    ]);
  });

  it('validates array items recursively', () => {
    const errors = validateAgainstJsonSchema(
      { items: [{ id: '1' }, { id: 2 }] },
      {
        type: 'object',
        properties: {
          items: {
            type: 'array',
            items: { type: 'object', properties: { id: { type: 'string' } } },
          },
        },
      },
    );
    expect(errors).toEqual(['$.items[1].id: expected string, got number']);
  });

  it('treats an array as not matching type object', () => {
    const errors = validateAgainstJsonSchema([1, 2, 3], { type: 'object' });
    expect(errors).toEqual(['$: expected object, got array']);
  });
});
