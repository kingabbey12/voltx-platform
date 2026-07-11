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

  it('starts_with / ends_with match string prefixes/suffixes', () => {
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'starts_with', value: 'urg' },
        input,
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'ends_with', value: 'ent' },
        input,
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'starts_with', value: 'zzz' },
        input,
        context,
      ),
    ).toBe(false);
  });

  it('regex matches a pattern and fails closed on an invalid pattern', () => {
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'regex', value: '^urg.*t$' },
        input,
        context,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        { path: 'context.check.tag', operator: 'regex', value: '(' },
        input,
        context,
      ),
    ).toBe(false);
  });

  it('date_gt / date_lt compare parseable dates', () => {
    const dateContext = { event: { occurredAt: '2026-06-15T00:00:00.000Z' } };
    expect(
      evaluateCondition(
        {
          path: 'context.event.occurredAt',
          operator: 'date_gt',
          value: '2026-01-01T00:00:00.000Z',
        },
        input,
        dateContext,
      ),
    ).toBe(true);
    expect(
      evaluateCondition(
        {
          path: 'context.event.occurredAt',
          operator: 'date_lt',
          value: '2026-01-01T00:00:00.000Z',
        },
        input,
        dateContext,
      ),
    ).toBe(false);
    expect(
      evaluateCondition(
        { path: 'context.event.occurredAt', operator: 'date_gt', value: 'not-a-date' },
        input,
        dateContext,
      ),
    ).toBe(false);
  });

  it('empty / not_empty reflect empty string/array/object semantics distinct from falsy', () => {
    const emptyContext = { a: '', b: [], c: {}, d: 0 };
    expect(evaluateCondition({ path: 'context.a', operator: 'empty' }, input, emptyContext)).toBe(
      true,
    );
    expect(evaluateCondition({ path: 'context.b', operator: 'empty' }, input, emptyContext)).toBe(
      true,
    );
    expect(evaluateCondition({ path: 'context.c', operator: 'empty' }, input, emptyContext)).toBe(
      true,
    );
    // 0 is falsy but not "empty" — the two operators are intentionally distinct.
    expect(evaluateCondition({ path: 'context.d', operator: 'empty' }, input, emptyContext)).toBe(
      false,
    );
    expect(
      evaluateCondition({ path: 'context.d', operator: 'not_empty' }, input, emptyContext),
    ).toBe(true);
  });

  describe('composite and/or/not', () => {
    it('and requires every child to be true', () => {
      expect(
        evaluateCondition(
          {
            and: [
              { path: 'context.check.approved', operator: 'truthy' },
              { path: 'context.check.count', operator: 'gt', value: 3 },
            ],
          },
          input,
          context,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          {
            and: [
              { path: 'context.check.approved', operator: 'truthy' },
              { path: 'context.check.count', operator: 'gt', value: 100 },
            ],
          },
          input,
          context,
        ),
      ).toBe(false);
    });

    it('or requires at least one child to be true', () => {
      expect(
        evaluateCondition(
          {
            or: [
              { path: 'context.check.count', operator: 'gt', value: 100 },
              { path: 'context.check.tag', operator: 'eq', value: 'urgent' },
            ],
          },
          input,
          context,
        ),
      ).toBe(true);
      expect(
        evaluateCondition(
          {
            or: [
              { path: 'context.check.count', operator: 'gt', value: 100 },
              { path: 'context.check.tag', operator: 'eq', value: 'nope' },
            ],
          },
          input,
          context,
        ),
      ).toBe(false);
    });

    it('not inverts its child', () => {
      expect(
        evaluateCondition(
          { not: { path: 'context.check.count', operator: 'gt', value: 100 } },
          input,
          context,
        ),
      ).toBe(true);
    });

    it('nests composite nodes arbitrarily deep', () => {
      expect(
        evaluateCondition(
          {
            and: [
              { path: 'context.check.approved', operator: 'truthy' },
              {
                or: [
                  { path: 'context.check.tag', operator: 'eq', value: 'nope' },
                  { not: { path: 'context.check.count', operator: 'gt', value: 100 } },
                ],
              },
            ],
          },
          input,
          context,
        ),
      ).toBe(true);
    });
  });
});
