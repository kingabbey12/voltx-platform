import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIGatewayService } from '../../ai/gateway/ai-gateway.service';
import { isAbortError } from '../../ai/streaming/drain-generator';
import { mergeAsyncGenerators } from '../../ai/streaming/merge-async-generators';
import { createTimeoutSignal } from '../../ai/agents/autonomous/create-timeout-signal';
import {
  WorkflowDefinition,
  WorkflowStepDefinition,
} from '../definition/workflow-definition.types';
import { WorkflowStepRunStatus } from '../entities/workflow-step-run.entity';
import { StepExecutionResult } from '../executors/step-executor.interface';
import { StepExecutorRegistry } from '../executors/step-executor.registry';
import { WorkflowCheckpointRepository } from '../workflow-checkpoint.repository';
import { WorkflowDeadLetterRepository } from '../workflow-dead-letter.repository';
import { WorkflowLogRepository } from '../workflow-log.repository';
import { WorkflowRetryRepository } from '../workflow-retry.repository';
import { WorkflowRunEntity } from '../entities/workflow-run.entity';
import { WorkflowRunRepository } from '../workflow-run.repository';
import { WorkflowStepRunRepository } from '../workflow-step-run.repository';
import { WorkflowVersionRepository } from '../workflow-version.repository';
import { WebhookDispatchService } from '../../webhooks/webhook-dispatch.service';
import { evaluateCondition } from './workflow-condition.util';
import { WorkflowStreamEvent } from './workflow-stream-event.types';

const TERMINAL_STEP_STATUSES: WorkflowStepRunStatus[] = ['SUCCEEDED', 'SKIPPED', 'CANCELLED'];

interface StepOutcome {
  stepId: string;
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED' | 'CANCELLED' | 'WAITING_APPROVAL';
  output: Record<string, unknown>;
  error?: string;
}

/**
 * The workflow runtime: drives one WorkflowRun's DAG forward from
 * whatever state it's persisted in (PENDING/PAUSED/WAITING_APPROVAL) to a
 * terminal state (SUCCEEDED/FAILED/CANCELLED), or until externally paused
 * again. Expressed as an async generator yielding WorkflowStreamEvent so
 * the same call backs both a JSON summary (drained) and a live SSE stream
 * — the same "one implementation, two consumption modes" convention used
 * by every other streaming subsystem in this codebase.
 *
 * Scheduling is a plain readiness scan over the definition's steps each
 * iteration (a step is ready once every dependsOn id is SUCCEEDED or
 * SKIPPED) rather than a precomputed topological order — the graph is
 * small enough per run that re-scanning is cheap, and it naturally
 * tolerates steps completing at different times within a wave. Everything
 * ready in a given iteration executes concurrently via
 * mergeAsyncGenerators (VT-022's live-interleaving primitive), so
 * independent branches genuinely run in parallel and their step-level
 * events stream as they happen rather than batched at the end.
 *
 * Persistence-first design: every state transition (step start, retry,
 * completion, checkpoint) is written before the corresponding event is
 * yielded, so a crash mid-run loses at most the in-flight step, and a
 * fresh executeRun() call against the same runId always picks up exactly
 * where the database says it left off — this is what makes pause/resume
 * and crash recovery the same code path.
 */
@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);
  private readonly activeRunControllers = new Map<string, AbortController>();
  private readonly defaultStepTimeoutMs: number;
  private readonly defaultMaxAttempts: number;
  private readonly defaultBackoffMs: number;

  constructor(
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly workflowVersionRepository: WorkflowVersionRepository,
    private readonly workflowStepRunRepository: WorkflowStepRunRepository,
    private readonly workflowLogRepository: WorkflowLogRepository,
    private readonly workflowCheckpointRepository: WorkflowCheckpointRepository,
    private readonly workflowRetryRepository: WorkflowRetryRepository,
    private readonly workflowDeadLetterRepository: WorkflowDeadLetterRepository,
    private readonly stepExecutorRegistry: StepExecutorRegistry,
    private readonly aiGatewayService: AIGatewayService,
    private readonly webhookDispatchService: WebhookDispatchService,
    configService: ConfigService,
  ) {
    this.defaultStepTimeoutMs = configService.get<number>('workflow.defaultStepTimeoutMs', 300_000);
    this.defaultMaxAttempts = configService.get<number>('workflow.defaultMaxAttempts', 1);
    this.defaultBackoffMs = configService.get<number>('workflow.defaultBackoffMs', 1000);
  }

  /** True if this process holds an active AbortController for the run — used to decide whether cancellation can be immediate. */
  isActiveInProcess(workflowRunId: string): boolean {
    return this.activeRunControllers.has(workflowRunId);
  }

  cancelInProcess(workflowRunId: string): void {
    this.activeRunControllers.get(workflowRunId)?.abort();
  }

  async *executeRun(
    workflowRunId: string,
    grantedPermissions: string[] = [],
  ): AsyncGenerator<WorkflowStreamEvent, void> {
    const version = await this.loadVersionForRun(workflowRunId);
    const definition = version.definition;
    const abortController = new AbortController();
    this.activeRunControllers.set(workflowRunId, abortController);

    try {
      let run = await this.workflowRunRepository.findById(workflowRunId);
      if (!run) {
        return;
      }

      if (run.status === 'PENDING') {
        run = await this.workflowRunRepository.updateWithVersion(workflowRunId, run.version, {
          status: 'RUNNING',
          startedAt: new Date(),
        });
        yield { type: 'workflow_started', workflowRunId };
        await this.workflowLogRepository.create({
          workflowRunId,
          event: 'WorkflowStarted',
          message: 'Workflow run started',
        });
      } else if (run.status === 'PAUSED' || run.status === 'WAITING_APPROVAL') {
        run = await this.workflowRunRepository.updateWithVersion(workflowRunId, run.version, {
          status: 'RUNNING',
        });
        yield { type: 'workflow_resumed', workflowRunId };
        await this.workflowLogRepository.create({
          workflowRunId,
          event: 'WorkflowResumed',
          message: 'Workflow run resumed',
        });
      }

      const stepRuns = await this.workflowStepRunRepository.listByRun(workflowRunId);
      const statusByStepId = new Map<string, WorkflowStepRunStatus>(
        stepRuns.map((stepRun) => [stepRun.stepId, stepRun.status]),
      );
      const stepById = new Map(definition.steps.map((step) => [step.id, step]));

      // Approval steps are deliberately excluded from the scheduler's own
      // `ready` set (see runLoop) to avoid a tight re-poll loop once a run
      // is paused on one. Reconciling them only happens here, once, at the
      // start of a fresh executeRun call (i.e. on resume) — re-entering the
      // executor lets it pick up an approval decision made while paused.
      for (const step of definition.steps) {
        if (statusByStepId.get(step.id) !== 'WAITING_APPROVAL') {
          continue;
        }

        const generator = this.runStepWithRetry(
          step,
          run,
          grantedPermissions,
          abortController.signal,
        );
        let generatorStep = await generator.next();
        while (!generatorStep.done) {
          yield generatorStep.value;
          generatorStep = await generator.next();
        }
        const outcome = generatorStep.value;
        statusByStepId.set(outcome.stepId, outcome.status);

        if (outcome.status === 'SUCCEEDED') {
          run = await this.mergeContext(run, outcome.stepId, outcome.output);
        } else if (outcome.status === 'FAILED') {
          yield* this.failRun(run, stepById, outcome, grantedPermissions);
          return;
        }
      }

      yield* this.runLoop(
        definition,
        stepById,
        workflowRunId,
        statusByStepId,
        grantedPermissions,
        abortController.signal,
      );
    } finally {
      this.activeRunControllers.delete(workflowRunId);
    }
  }

  private async *runLoop(
    definition: WorkflowDefinition,
    stepById: Map<string, WorkflowStepDefinition>,
    workflowRunId: string,
    statusByStepId: Map<string, WorkflowStepRunStatus>,
    grantedPermissions: string[],
    signal: AbortSignal,
  ): AsyncGenerator<WorkflowStreamEvent, void> {
    while (true) {
      const run = await this.workflowRunRepository.findById(workflowRunId);
      if (!run) {
        return;
      }

      if (run.status === 'CANCELLED') {
        yield { type: 'workflow_cancelled', workflowRunId };
        return;
      }
      if (run.status === 'PAUSED') {
        yield { type: 'workflow_paused', workflowRunId };
        return;
      }
      if (signal.aborted) {
        await this.workflowRunRepository.updateWithVersion(workflowRunId, run.version, {
          status: 'CANCELLED',
          error: 'Cancelled',
          completedAt: new Date(),
        });
        yield { type: 'workflow_cancelled', workflowRunId };
        return;
      }

      const allTerminal = definition.steps.every((step) =>
        isTerminalStatus(statusByStepId.get(step.id)),
      );
      if (allTerminal) {
        await this.completeRun(run);
        yield { type: 'workflow_completed', workflowRunId };
        return;
      }

      const ready = definition.steps.filter((step) => {
        const status = statusByStepId.get(step.id);
        if (status && (isTerminalStatus(status) || status === 'RUNNING' || status === 'RETRYING')) {
          return false;
        }
        if (status === 'WAITING_APPROVAL') {
          return false;
        }
        return (step.dependsOn ?? []).every((dependencyId) => {
          const dependencyStatus = statusByStepId.get(dependencyId);
          return dependencyStatus === 'SUCCEEDED' || dependencyStatus === 'SKIPPED';
        });
      });

      if (ready.length === 0) {
        const waitingApproval = definition.steps.some(
          (step) => statusByStepId.get(step.id) === 'WAITING_APPROVAL',
        );
        if (waitingApproval) {
          await this.workflowRunRepository.updateWithVersion(workflowRunId, run.version, {
            status: 'WAITING_APPROVAL',
          });
          yield { type: 'workflow_paused', workflowRunId };
          return;
        }
        // Defensive: validated definitions can't deadlock, but guard against it anyway.
        this.logger.warn(
          { workflowRunId },
          'Workflow scheduler found no ready steps but run is not complete',
        );
        return;
      }

      const toRun: WorkflowStepDefinition[] = [];
      for (const step of ready) {
        if (step.condition && !evaluateCondition(step.condition, run.input, run.context)) {
          await this.skipStep(workflowRunId, step);
          statusByStepId.set(step.id, 'SKIPPED');
          yield { type: 'step_skipped', workflowRunId, stepId: step.id };
        } else {
          toRun.push(step);
        }
      }

      if (toRun.length === 0) {
        continue;
      }

      const generators = toRun.map((step) =>
        this.runStepWithRetry(step, run, grantedPermissions, signal),
      );
      const merged = mergeAsyncGenerators(generators);

      let mergedStep = await merged.next();
      while (!mergedStep.done) {
        yield mergedStep.value;
        mergedStep = await merged.next();
      }
      const outcomes = mergedStep.value;

      let latestRun = run;
      for (const outcome of outcomes) {
        statusByStepId.set(outcome.stepId, outcome.status);
        if (outcome.status === 'SUCCEEDED') {
          latestRun = await this.mergeContext(latestRun, outcome.stepId, outcome.output);
        }
      }

      const failure = outcomes.find((outcome) => outcome.status === 'FAILED');
      if (failure) {
        yield* this.failRun(latestRun, stepById, failure, grantedPermissions);
        return;
      }
    }
  }

  private async *runStepWithRetry(
    step: WorkflowStepDefinition,
    run: WorkflowRunEntity,
    grantedPermissions: string[],
    externalSignal: AbortSignal,
  ): AsyncGenerator<WorkflowStreamEvent, StepOutcome> {
    const stepRun = await this.workflowStepRunRepository.upsertPending({
      workflowRunId: run.id,
      stepId: step.id,
      type: step.type,
      input: stepInputFor(step),
    });

    yield { type: 'step_started', workflowRunId: run.id, stepId: step.id };
    await this.workflowLogRepository.create({
      workflowRunId: run.id,
      stepRunId: stepRun.id,
      event: 'StepStarted',
      message: `Step "${step.id}" started`,
    });

    const maxAttempts = step.retryPolicy?.maxAttempts ?? this.defaultMaxAttempts;
    const backoffMs = step.retryPolicy?.backoffMs ?? this.defaultBackoffMs;
    const backoffMultiplier = step.retryPolicy?.backoffMultiplier ?? 1;
    const timeoutMs = step.timeoutMs ?? this.defaultStepTimeoutMs;

    let attempt = 0;

    while (attempt < maxAttempts) {
      attempt += 1;
      const startedAt = Date.now();
      await this.workflowStepRunRepository.update(stepRun.id, {
        status: attempt > 1 ? 'RETRYING' : 'RUNNING',
        attempt,
        startedAt: new Date(),
      });

      const timeout = createTimeoutSignal(timeoutMs, externalSignal);

      try {
        const executor = this.stepExecutorRegistry.get(step.type);
        const result: StepExecutionResult = await executor.execute(step, {
          organizationId: run.organizationId,
          workflowRunId: run.id,
          stepRunId: stepRun.id,
          conversationId: run.conversationId,
          runInput: run.input,
          runContext: run.context,
          grantedPermissions,
          signal: timeout.signal,
        });

        if (result.waiting) {
          await this.workflowStepRunRepository.update(stepRun.id, { status: 'WAITING_APPROVAL' });
          yield { type: 'step_waiting_approval', workflowRunId: run.id, stepId: step.id };
          return { stepId: step.id, status: 'WAITING_APPROVAL', output: {} };
        }

        const durationMs = Date.now() - startedAt;
        await this.workflowStepRunRepository.update(stepRun.id, {
          status: 'SUCCEEDED',
          output: result.output,
          completedAt: new Date(),
          durationMs,
        });
        await this.workflowCheckpointRepository.create({
          workflowRunId: run.id,
          stepId: step.id,
          state: { ...run.context, [step.id]: result.output },
        });
        await this.workflowLogRepository.create({
          workflowRunId: run.id,
          stepRunId: stepRun.id,
          event: 'StepCompleted',
          message: `Step "${step.id}" completed`,
        });
        yield { type: 'step_completed', workflowRunId: run.id, stepId: step.id };

        return { stepId: step.id, status: 'SUCCEEDED', output: result.output };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Step execution failed';

        if (isAbortError(error) && externalSignal.aborted && !timeout.didTimeOut()) {
          await this.workflowStepRunRepository.update(stepRun.id, {
            status: 'CANCELLED',
            error: message,
          });
          return { stepId: step.id, status: 'CANCELLED', output: {}, error: message };
        }

        if (attempt < maxAttempts) {
          const delayMs = Math.round(backoffMs * Math.pow(backoffMultiplier, attempt - 1));
          await this.workflowRetryRepository.create({
            stepRunId: stepRun.id,
            attemptNumber: attempt,
            error: message,
            delayMs,
          });
          yield { type: 'step_retrying', workflowRunId: run.id, stepId: step.id, attempt };
          await sleep(delayMs);
          continue;
        }

        await this.workflowStepRunRepository.update(stepRun.id, {
          status: 'FAILED',
          error: message,
          completedAt: new Date(),
        });
        await this.workflowLogRepository.create({
          workflowRunId: run.id,
          stepRunId: stepRun.id,
          level: 'ERROR',
          event: 'StepFailed',
          message,
        });
        await this.workflowDeadLetterRepository.create({
          workflowRunId: run.id,
          stepId: step.id,
          reason: message,
          payload: { input: stepInputFor(step) },
        });
        yield { type: 'step_failed', workflowRunId: run.id, stepId: step.id, error: message };

        return { stepId: step.id, status: 'FAILED', output: {}, error: message };
      } finally {
        timeout.clear();
      }
    }

    return { stepId: step.id, status: 'FAILED', output: {}, error: 'Retry attempts exhausted' };
  }

  private async skipStep(workflowRunId: string, step: WorkflowStepDefinition): Promise<void> {
    const stepRun = await this.workflowStepRunRepository.upsertPending({
      workflowRunId,
      stepId: step.id,
      type: step.type,
      input: stepInputFor(step),
    });
    await this.workflowStepRunRepository.update(stepRun.id, {
      status: 'SKIPPED',
      completedAt: new Date(),
    });
    await this.workflowLogRepository.create({
      workflowRunId,
      stepRunId: stepRun.id,
      event: 'StepSkipped',
      message: `Step "${step.id}" skipped (condition not met)`,
    });
  }

  /**
   * A pause/cancel request lands as a separate, concurrent
   * updateWithVersion call against the same run row — if it lands between
   * when this step read `run` and when it tries to persist its output,
   * the version this step is holding is now stale and the optimistic
   * write throws ConflictException. Losing a just-completed step's
   * output to that race would be wrong (the step really did succeed);
   * retry once against the freshest version instead of letting the
   * conflict escape and abort the whole run.
   */
  private async mergeContext(
    run: WorkflowRunEntity,
    stepId: string,
    output: Record<string, unknown>,
  ): Promise<WorkflowRunEntity> {
    try {
      return await this.workflowRunRepository.updateWithVersion(run.id, run.version, {
        context: { ...run.context, [stepId]: output },
      });
    } catch (error) {
      if (!(error instanceof ConflictException)) {
        throw error;
      }

      const latest = await this.workflowRunRepository.findById(run.id);
      if (!latest) {
        throw error;
      }
      return this.workflowRunRepository.updateWithVersion(run.id, latest.version, {
        context: { ...latest.context, [stepId]: output },
      });
    }
  }

  private async completeRun(run: WorkflowRunEntity): Promise<void> {
    const completedAt = new Date();
    await this.workflowRunRepository.updateWithVersion(run.id, run.version, {
      status: 'SUCCEEDED',
      output: run.context,
      completedAt,
      durationMs: run.startedAt ? completedAt.getTime() - run.startedAt.getTime() : undefined,
    });
    await this.workflowLogRepository.create({
      workflowRunId: run.id,
      event: 'WorkflowCompleted',
      message: 'Workflow run completed successfully',
    });
    await this.webhookDispatchService.publish('workflow.run.completed', run.organizationId, {
      workflowRunId: run.id,
      workflowId: run.workflowId,
    });
  }

  private async *failRun(
    run: WorkflowRunEntity,
    stepById: Map<string, WorkflowStepDefinition>,
    failure: StepOutcome,
    grantedPermissions: string[],
  ): AsyncGenerator<WorkflowStreamEvent, void> {
    await this.runCompensation(run, stepById, grantedPermissions);

    const completedAt = new Date();
    await this.workflowRunRepository.updateWithVersion(run.id, run.version, {
      status: 'FAILED',
      error: failure.error ?? 'Workflow run failed',
      completedAt,
      durationMs: run.startedAt ? completedAt.getTime() - run.startedAt.getTime() : undefined,
    });
    await this.workflowLogRepository.create({
      workflowRunId: run.id,
      level: 'ERROR',
      event: 'WorkflowFailed',
      message: `Workflow run failed at step "${failure.stepId}": ${failure.error ?? 'unknown error'}`,
    });
    await this.webhookDispatchService.publish('workflow.run.failed', run.organizationId, {
      workflowRunId: run.id,
      workflowId: run.workflowId,
      error: failure.error ?? 'Workflow run failed',
    });
    yield {
      type: 'workflow_failed',
      workflowRunId: run.id,
      error: failure.error ?? 'Workflow run failed',
    };
  }

  /**
   * Best-effort rollback: walks every step run that has succeeded, in
   * reverse, invoking its compensation tool call if it declared one. A
   * compensation failure is logged but never aborts the rest of the
   * rollback — partial compensation is strictly better than none.
   */
  private async runCompensation(
    run: WorkflowRunEntity,
    stepById: Map<string, WorkflowStepDefinition>,
    grantedPermissions: string[],
  ): Promise<void> {
    const stepRuns = await this.workflowStepRunRepository.listByRun(run.id);
    const succeeded = stepRuns
      .filter((stepRun) => stepRun.status === 'SUCCEEDED')
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

    for (const stepRun of succeeded) {
      const step = stepById.get(stepRun.stepId);
      if (!step?.compensation) {
        continue;
      }

      try {
        await this.aiGatewayService.executeTool(
          {
            conversationId: run.conversationId,
            toolName: step.compensation.toolName,
            input: step.compensation.input,
          },
          { grantedPermissions },
        );
        await this.workflowLogRepository.create({
          workflowRunId: run.id,
          stepRunId: stepRun.id,
          event: 'CompensationExecuted',
          message: `Compensation for step "${step.id}" executed`,
        });
      } catch (error) {
        this.logger.warn(
          { err: error, workflowRunId: run.id, stepId: step.id },
          'Compensation hook failed; continuing rollback',
        );
        await this.workflowLogRepository.create({
          workflowRunId: run.id,
          stepRunId: stepRun.id,
          level: 'WARN',
          event: 'CompensationFailed',
          message: `Compensation for step "${step.id}" failed: ${
            error instanceof Error ? error.message : 'unknown error'
          }`,
        });
      }
    }
  }

  private async loadVersionForRun(workflowRunId: string) {
    const run = await this.workflowRunRepository.findById(workflowRunId);
    if (!run) {
      throw new Error(`Workflow run "${workflowRunId}" not found`);
    }
    const version = await this.workflowVersionRepository.findById(run.workflowVersionId);
    if (!version) {
      throw new Error(`Workflow version "${run.workflowVersionId}" not found`);
    }
    return version;
  }
}

function isTerminalStatus(status: WorkflowStepRunStatus | undefined): boolean {
  return status !== undefined && TERMINAL_STEP_STATUSES.includes(status);
}

function stepInputFor(step: WorkflowStepDefinition): Record<string, unknown> {
  return step.config as unknown as Record<string, unknown>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
