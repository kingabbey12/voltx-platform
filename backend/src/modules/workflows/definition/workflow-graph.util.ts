import { WorkflowStepDefinition } from './workflow-definition.types';

/**
 * Depth-first cycle detection over the `dependsOn` graph (classic
 * white/gray/black coloring). Returns the cycle as an ordered list of step
 * ids (first repeated at the end) if one exists, otherwise null. Shared by
 * WorkflowDefinitionValidatorService (reject at publish time) — the
 * engine's own scheduler doesn't need this at runtime since a definition
 * can only reach execution after passing validation.
 */
export function findDependencyCycle(steps: WorkflowStepDefinition[]): string[] | null {
  const dependsOnById = new Map(steps.map((step) => [step.id, step.dependsOn ?? []]));
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>(steps.map((step) => [step.id, WHITE]));
  const path: string[] = [];
  let cycle: string[] | null = null;

  function visit(id: string): void {
    if (cycle) {
      return;
    }
    color.set(id, GRAY);
    path.push(id);

    for (const dependencyId of dependsOnById.get(id) ?? []) {
      if (cycle) {
        return;
      }
      const dependencyColor = color.get(dependencyId);
      if (dependencyColor === GRAY) {
        const cycleStart = path.indexOf(dependencyId);
        cycle = [...path.slice(cycleStart), dependencyId];
        return;
      }
      if (dependencyColor === WHITE) {
        visit(dependencyId);
      }
    }

    path.pop();
    color.set(id, BLACK);
  }

  for (const step of steps) {
    if (cycle) {
      break;
    }
    if (color.get(step.id) === WHITE) {
      visit(step.id);
    }
  }

  return cycle;
}
