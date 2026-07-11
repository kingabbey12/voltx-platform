import { Injectable } from '@nestjs/common';
import { SwitchStepDefinition } from '../definition/workflow-definition.types';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * Resolves `config.path` against `{ input, context }` and finds the
 * matching case (or `defaultNext`). This step does not itself skip other
 * steps — a SWITCH introduces no new engine primitive — instead it writes
 * the matched target to its own output (`context.<switchStepId>.next`),
 * and each candidate downstream branch step is authored with
 * `dependsOn: [switchStepId]` plus a condition
 * `{ path: "context.<switchStepId>.next", operator: "eq", value: "<its own id>" }`
 * so the engine's existing false-condition-skips-the-step behavior does
 * the actual branching. This reuses the condition engine end to end
 * rather than adding a second, competing branching mechanism.
 */
@Injectable()
export class SwitchStepExecutor implements StepExecutor {
  readonly type = 'SWITCH' as const;

  execute(step: SwitchStepDefinition, context: StepExecutionContext): Promise<StepExecutionResult> {
    const value = resolvePath(step.config.path, {
      input: context.runInput,
      context: context.runContext,
    });

    const matched = step.config.cases.find((branch) => branch.value === value);
    const next = matched?.next ?? step.config.defaultNext ?? null;

    return Promise.resolve({ output: { matchedValue: value, next } });
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
