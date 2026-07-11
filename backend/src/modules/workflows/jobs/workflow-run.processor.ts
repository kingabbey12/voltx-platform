import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { drainToReturnValue } from '../../ai/streaming/drain-generator';
import { WorkflowEngineService } from '../engine/workflow-engine.service';
import { WORKFLOW_RUN_QUEUE } from './workflow-run-queue.constants';
import { WorkflowRunJobData } from './workflow-run-queue.service';

/**
 * Drains the exact same WorkflowEngineService.executeRun() generator the
 * synchronous (Redis-disabled) fallback path and the old inline call
 * sites always used — this processor is purely a "run it from a worker
 * instead of the HTTP request" wrapper, not a re-implementation. A job
 * that throws is retried per the queue's configured backoff; once
 * attempts are exhausted, BullMQ reports it failed and
 * DeadLetterListenerService (v1.9.1) records it in BackgroundJobFailure —
 * the run's own row also carries its FAILED status and error independent
 * of this, via the engine's normal completion path.
 */
@Processor(WORKFLOW_RUN_QUEUE)
export class WorkflowRunProcessor extends WorkerHost {
  constructor(private readonly workflowEngineService: WorkflowEngineService) {
    super();
  }

  async process(job: Job<WorkflowRunJobData>): Promise<void> {
    await drainToReturnValue(
      this.workflowEngineService.executeRun(job.data.workflowRunId, job.data.grantedPermissions),
    );
  }
}
