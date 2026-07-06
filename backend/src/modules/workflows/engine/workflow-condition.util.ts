import { StepCondition } from '../definition/workflow-definition.types';

/**
 * Evaluates a step's condition against `{ input, context }` (the run's
 * trigger input and its accumulated per-step outputs). A step whose
 * condition is absent always runs; one whose condition evaluates false is
 * SKIPPED by the engine rather than failed — conditional branching is a
 * routing decision, not an error.
 */
export function evaluateCondition(
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
    default:
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
