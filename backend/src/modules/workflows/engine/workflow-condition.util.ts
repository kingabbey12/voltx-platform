import { StepCondition, StepConditionNode } from '../definition/workflow-definition.types';

/**
 * Evaluates a step's condition against `{ input, context }` (the run's
 * trigger input and its accumulated per-step outputs). A step whose
 * condition is absent always runs; one whose condition evaluates false is
 * SKIPPED by the engine rather than failed — conditional branching is a
 * routing decision, not an error. Recurses over StepConditionNode's
 * and/or/not composition before falling through to leaf evaluation.
 */
export function evaluateCondition(
  condition: StepConditionNode,
  input: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  if ('and' in condition) {
    return condition.and.every((child) => evaluateCondition(child, input, context));
  }
  if ('or' in condition) {
    return condition.or.some((child) => evaluateCondition(child, input, context));
  }
  if ('not' in condition) {
    return !evaluateCondition(condition.not, input, context);
  }
  return evaluateLeaf(condition, input, context);
}

function evaluateLeaf(
  condition: StepCondition,
  input: Record<string, unknown>,
  context: Record<string, unknown>,
): boolean {
  const value = resolvePath(condition.path, { input, context });

  switch (condition.operator) {
    case 'eq':
      return value === condition.value;
    case 'neq':
      return value !== condition.value;
    case 'exists':
      return value !== undefined;
    case 'not_exists':
      return value === undefined;
    case 'truthy':
      return Boolean(value);
    case 'falsy':
      return !value;
    case 'gt':
      return (
        typeof value === 'number' && typeof condition.value === 'number' && value > condition.value
      );
    case 'lt':
      return (
        typeof value === 'number' && typeof condition.value === 'number' && value < condition.value
      );
    case 'contains':
      if (typeof value === 'string') {
        return typeof condition.value === 'string' && value.includes(condition.value);
      }
      return Array.isArray(value) && value.includes(condition.value);
    case 'starts_with':
      return (
        typeof value === 'string' &&
        typeof condition.value === 'string' &&
        value.startsWith(condition.value)
      );
    case 'ends_with':
      return (
        typeof value === 'string' &&
        typeof condition.value === 'string' &&
        value.endsWith(condition.value)
      );
    case 'regex':
      return (
        typeof value === 'string' &&
        typeof condition.value === 'string' &&
        tryRegexTest(condition.value, value)
      );
    case 'date_gt': {
      const left = toDate(value);
      const right = toDate(condition.value);
      return left !== null && right !== null && left.getTime() > right.getTime();
    }
    case 'date_lt': {
      const left = toDate(value);
      const right = toDate(condition.value);
      return left !== null && right !== null && left.getTime() < right.getTime();
    }
    case 'empty':
      return isEmpty(value);
    case 'not_empty':
      return !isEmpty(value);
    default:
      return false;
  }
}

function isEmpty(value: unknown): boolean {
  if (value === undefined || value === null || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date) return value;
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** A malformed pattern from a stored definition should fail the condition, not crash the run. */
function tryRegexTest(pattern: string, value: string): boolean {
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return false;
  }
}

function resolvePath(path: string, root: Record<string, unknown>): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (typeof current !== 'object' || current === null) {
      return undefined;
    }
    return (current as Record<string, unknown>)[segment];
  }, root);
}
