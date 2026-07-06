import { findDependencyCycle } from '../src/modules/workflows/definition/workflow-graph.util';
import { WorkflowStepDefinition } from '../src/modules/workflows/definition/workflow-definition.types';

function step(id: string, dependsOn: string[] = []): WorkflowStepDefinition {
  return {
    id,
    name: id,
    type: 'DELAY',
    dependsOn,
    config: { delayMs: 1 },
  };
}

describe('findDependencyCycle', () => {
  it('returns null for a DAG with no dependencies', () => {
    expect(findDependencyCycle([step('a'), step('b'), step('c')])).toBeNull();
  });

  it('returns null for a linear chain', () => {
    const steps = [step('a'), step('b', ['a']), step('c', ['b'])];
    expect(findDependencyCycle(steps)).toBeNull();
  });

  it('returns null for a diamond (parallel branches merging)', () => {
    const steps = [step('a'), step('b', ['a']), step('c', ['a']), step('d', ['b', 'c'])];
    expect(findDependencyCycle(steps)).toBeNull();
  });

  it('detects a direct self-cycle', () => {
    const steps = [step('a', ['a'])];
    const cycle = findDependencyCycle(steps);
    expect(cycle).toEqual(['a', 'a']);
  });

  it('detects a two-node cycle', () => {
    const steps = [step('a', ['b']), step('b', ['a'])];
    const cycle = findDependencyCycle(steps);
    expect(cycle).not.toBeNull();
    expect(cycle).toContain('a');
    expect(cycle).toContain('b');
  });

  it('detects a longer cycle buried among unrelated steps', () => {
    const steps = [
      step('unrelated1'),
      step('a', ['c']),
      step('b', ['a']),
      step('c', ['b']),
      step('unrelated2', ['unrelated1']),
    ];
    const cycle = findDependencyCycle(steps);
    expect(cycle).not.toBeNull();
    expect(cycle).toEqual(expect.arrayContaining(['a', 'b', 'c']));
  });
});
