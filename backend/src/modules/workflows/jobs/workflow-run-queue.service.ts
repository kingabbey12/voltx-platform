import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { drainToReturnValue } from '../../ai/streaming/drain-generator';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { WORKFLOW_RUN_QUEUE } from './workflow-run-queue.constants';

export interface WorkflowRunJobData {
  workflowRunId: string;
  grantedPermissions: string[];
  /** Best-effort — carried through so a job that exhausts its retries can be attributed to an org in BackgroundJobFailure without the dead-letter listener needing to look anything up. */
  organizationId?: string | null;
}

/**
 * Dispatches (or, absent Redis, directly drives) one pass of
 * WorkflowEngineService.executeRun — the engine's own step-execution,
 * retry, checkpoint, and compensation logic is entirely unchanged, this
 * only decides *where* executeRun runs: inline in the calling
 * request (today's behavior, preserved whenever Redis is disabled — dev/
 * test are unaffected) or in a BullMQ worker (production, where Redis is
 * mandatory per v1.9.1's assertRedisRequirement). Every call site in
 * WorkflowService that used to `await drainToReturnValue(executeRun(...))`
 * directly now goes through here instead — same external contract in
 * fallback mode (awaits full completion before returning), genuinely
 * asynchronous in queued mode.
 *
 * The engine's own runLoop already re-reads WorkflowRun.status from the
 * database every iteration and stops on CANCELLED (see
 * workflow-engine.service.ts) — cross-instance cancellation therefore
 * already works correctly with no additional flag; cancelInProcess()
 * remains a same-process optimization for instant (rather than
 * next-iteration) interruption.
 */
@Injectable()
export class WorkflowRunQueueService {
  private readonly logger = new Logger(WorkflowRunQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(WORKFLOW_RUN_QUEUE)
    private readonly queue: Queue<WorkflowRunJobData> | null,
    private readonly workflowEngineService: WorkflowEngineService,
  ) {}

  /**
   * `version` is WorkflowRun's existing optimistic-concurrency counter
   * (bumped on every state transition — pause/resume/retry/approval-
   * decide all move it). Using `run:<id>:<version>` as the deterministic
   * jobId — not a bare `run:<id>` — matters: a run is legitimately
   * re-entered many times over its life (initial run, resume, retry,
   * post-approval re-drive), and BullMQ does not remove completed jobs by
   * default, so a jobId reused across separate re-entries would silently
   * return the first (already-finished) job instead of executing again.
   * Keying on the version the caller observed still collapses truly
   * simultaneous duplicate calls for the *same* transition (e.g. a
   * double-clicked Resume button), since concurrent callers read the same
   * pre-transition version.
   */
  async enqueueRun(
    workflowRunId: string,
    version: number,
    grantedPermissions: string[] = [],
    organizationId?: string | null,
  ): Promise<void> {
    if (!this.queue) {
      await drainToReturnValue(
        this.workflowEngineService.executeRun(workflowRunId, grantedPermissions),
      );
      return;
    }

    await this.queue.add(
      'execute_run',
      { workflowRunId, grantedPermissions, organizationId },
      {
        jobId: `run:${workflowRunId}:${version}`,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    this.logger.log({ workflowRunId }, 'Enqueued workflow run for background execution');
  }
}
