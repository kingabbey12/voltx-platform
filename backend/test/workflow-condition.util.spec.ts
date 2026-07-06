import { evaluateCondition } from '../src/modules/workflows/engine/workflow-condition.util';

describe('evaluateCondition', () => {
  const context = { check: { approved: true, count: 5, tag: 'urgent', tags: ['a', 'b'] } };
  const input = { region: 'us-east-1' };

  it('eq matches an equal value', () => {
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'eq', value: 'urgent' },
        input,
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'eq', value: 'other' },
        input,
        context,
      ),
    ).toBe(false);
  });

  it('neq matches a different value', () => {
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'neq', value: 'other' },
        input,
        context,
      ),
    ).toBe(true);
  });

  it('exists / not_exists reflect whether the path resolves', () => {
    expect(
      evaluateCondition({ path: 'context.check.approved', operator: 'exists' }, input, context),
    ).toBe(true);
    expect(
      evaluateCondition({ path: 'context.check.missing', operator: 'exists' }, input, context),
    ).toBe(false);
    expect(
      evaluateCondition({ path: 'context.check.missing', operator: 'not_exists' }, input, context),
    ).toBe(true);
  });

  it('truthy / falsy reflect boolean coercion', () => {
    expect(
      evaluateCondition({ path: 'context.check.approved', operator: 'truthy' }, input, context),
    ).toBe(true);
    expect(
      evaluateCondition({ path: 'context.check.missing', operator: 'falsy' }, input, context),
    ).toBe(true);
  });

  it('gt / lt compare numbers', () => {
    expect(
      evaluateCondition({ path: 'context.check.count', operator: 'gt', value: 3 }, input, context),
    ).toBe(true);
    expect(
      evaluateCondition({ path: 'context.check.count', operator: 'gt', value: 10 }, input, context),
    ).toBe(false);
    expect(
      evaluateCondition({ path: 'context.check.count', operator: 'lt', value: 10 }, input, context),
    ).toBe(true);
  });

  it('gt / lt return false for non-numeric values', () => {
    expect(
      evaluateCondition({ path: 'context.check.tag', operator: 'gt', value: 3 }, input, context),
    ).toBe(false);
  });

  it('contains matches a substring for strings', () => {
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'contains', value: 'rgen' },
        input,
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'contains', value: 'zzz' },
        input,
        context,
      ),
    ).toBe(false);
  });

  it('contains matches array membership', () => {
    expect(
      evaluateCondition(
        { path: 'context.check.tags', operator: 'contains', value: 'a' },
        input,
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'context.check.tags', operator: 'contains', value: 'z' },
        input,
        context,
      ),
    ).toBe(false);
  });

  it('resolves paths rooted at input as well as context', () => {
    expect(
      evaluateCondition(
        { path: 'input.region', operator: 'eq', value: 'us-east-1' },
        input,
        context,
      ),
    ).toBe(true);
  });

  it('resolves an unknown root path to undefined without throwing', () => {
    expect(
      evaluateCondition({ path: 'nonexistent.deeply.nested', operator: 'exists' }, input, context),
    ).toBe(false);
  });
});
