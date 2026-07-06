import { Injectable } from '@nestjs/common';
import { DelayStepDefinition } from '../definition/workflow-definition.types';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * Blocks the executing process for `config.delayMs`, interruptible via
 * the step's AbortSignal (cancellation/timeout). This engine has no
 * external job queue, so a DELAY step ties up whatever is currently
 * driving execution (the triggering request, or the scheduler's
 * in-process run) for its full duration — acceptable for the short
 * "wait a beat between steps" delays this step type is meant for. A
 * workflow that needs to wait hours/days should use a CRON/DELAYED
 * WorkflowSchedule to start a follow-up run instead of an in-run DELAY
 * step.
 */
@Injectable()
export class DelayStepExecutor implements StepExecutor {
  readonly type = 'DELAY' as const;

  async execute(
    step: DelayStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    await delay(step.config.delayMs, context.signal);
    return { output: { delayedMs: step.config.delayMs } };
  }
}

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Delay was aborted'));
      return;
    }

    const timeoutHandle = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timeoutHandle);
        reject(new Error('Delay was aborted'));
      },
      { once: true },
    );
  });
}
