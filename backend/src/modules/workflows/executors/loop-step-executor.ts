import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { evaluateCondition } from '../engine/workflow-condition.util';
import { LoopStepDefinition } from '../definition/workflow-definition.types';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';
import { StepExecutorRegistry } from './step-executor.registry';

/**
 * Iterates `config.itemsPath` and runs `config.steps` once per item,
 * dispatching each nested step to its own executor via the registry
 * (circular by construction — the registry holds this executor, this
 * executor calls back into the registry — hence forwardRef). Nested
 * steps run strictly sequentially, in declared order, once per item;
 * there is no nested-DAG/parallelism within a single loop body, and a
 * nested step's own retryPolicy/timeoutMs/compensation are NOT applied
 * independently (only its `condition` gate is honored, reusing the same
 * evaluateCondition every top-level step already uses) — a failure
 * anywhere in the body fails the whole LOOP step, which then goes through
 * the engine's normal step-level retry/dead-letter handling for the LOOP
 * step itself. Keep loop bodies simple; a loop iteration that itself
 * needs retries/compensation should call a sub-workflow instead.
 */
@Injectable()
export class LoopStepExecutor implements StepExecutor {
  readonly type = 'LOOP' as const;

  constructor(
    @Inject(forwardRef(() => StepExecutorRegistry))
    private readonly stepExecutorRegistry: StepExecutorRegistry,
  ) {}

  async execute(
    step: LoopStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const resolvedItems = resolvePath(step.config.itemsPath, {
      input: context.runInput,
      context: context.runContext,
    });
    if (!Array.isArray(resolvedItems)) {
      throw new Error(
        `LOOP step "${step.id}": itemsPath "${step.config.itemsPath}" did not resolve to an array`,
      );
    }
    // Array.isArray narrows to any[] in TS's lib typings — re-widen to unknown[]
    // so indexing below stays type-safe instead of silently propagating `any`.
    const items: unknown[] = resolvedItems;

    const limit = step.config.maxIterations ?? items.length;
    const iterationResults: Record<string, unknown>[] = [];

    for (let index = 0; index < Math.min(items.length, limit); index += 1) {
      if (context.signal?.aborted) {
        throw new Error(`LOOP step "${step.id}" was aborted`);
      }

      const iterationOutputs: Record<string, unknown> = {};
      const iterationBaseContext = {
        ...context.runContext,
        loopItem: items[index],
        loopIndex: index,
      };

      for (const nestedStep of step.config.steps) {
        const mergedContext = { ...iterationBaseContext, ...iterationOutputs };
        if (
          nestedStep.condition &&
          !evaluateCondition(nestedStep.condition, context.runInput, mergedContext)
        ) {
          continue;
        }

        const executor = this.stepExecutorRegistry.get(nestedStep.type);
        const result = await executor.execute(nestedStep, {
          ...context,
          runContext: mergedContext,
        });
        iterationOutputs[nestedStep.id] = result.output;
      }

      iterationResults.push(iterationOutputs);
    }

    return { output: { items: iterationResults, count: iterationResults.length } };
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
