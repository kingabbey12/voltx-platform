import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentRunResumeService } from '../approvals/agent-run-resume.service';
import { AgentSchedulerRunService } from '../scheduling/agent-scheduler-run.service';
import { AGENT_TASK_QUEUE } from './agent-task-queue.constants';

export interface ResumeAfterApprovalJobData {
  kind: 'resume_after_approval';
  agentRunId: string;
  approvalId: string;
  /** Best-effort — carried through so a job that exhausts its retries can be attributed to an org in BackgroundJobFailure without the dead-letter listener needing to look anything up. */
  organizationId?: string | null;
}

export interface RunScheduledAgentJobData {
  kind: 'run_scheduled_agent';
  scheduleId: string;
  agentId: string;
  organizationId: string;
  input: Record<string, unknown>;
}

export type AgentTaskJobData = ResumeAfterApprovalJobData | RunScheduledAgentJobData;

/**
 * Generic background-task execution for the AI module — "background task
 * execution" for AI Operator v1.9. Queue injection is optional, exactly
 * mirroring the communications module's AiProcessQueueService: when
 * REDIS_ENABLED is false, enqueue falls back to running the job directly
 * (fire-and-forget) instead of silently dropping it.
 */
@Injectable()
export class AgentTaskQueueService {
  private readonly logger = new Logger(AgentTaskQueueService.name);

  constructor(
    @Optional()
    @InjectQueue(AGENT_TASK_QUEUE)
    private readonly queue: Queue<AgentTaskJobData> | null,
    private readonly agentRunResumeService: AgentRunResumeService,
    private readonly agentSchedulerRunService: AgentSchedulerRunService,
  ) {}

  enqueueResumeAfterApproval(
    agentRunId: string,
    approvalId: string,
    organizationId?: string | null,
  ): void {
    if (!this.queue) {
      void this.agentRunResumeService
        .resume(agentRunId, approvalId)
        .catch((error: unknown) =>
          this.logger.error(
            { err: error, agentRunId, approvalId },
            'Synchronous-fallback agent run resume failed',
          ),
        );
      return;
    }

    void this.queue
      .add(
        'resume_after_approval',
        { kind: 'resume_after_approval', agentRunId, approvalId, organizationId },
        {
          // Deterministic per-approval id: a duplicate enqueue for the same
          // approval (e.g. a retried decide() call) collides in BullMQ
          // instead of creating a second job — the atomic claim in
          // AgentRunResumeService is the actual double-execution guard,
          // this just avoids doing unnecessary duplicate work.
          jobId: `resume:${approvalId}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      )
      .catch((error: unknown) =>
        this.logger.error(
          { err: error, agentRunId, approvalId },
          'Failed to enqueue agent run resume job',
        ),
      );
  }

  enqueueScheduledAgentRun(
    scheduleId: string,
    agentId: string,
    organizationId: string,
    input: Record<string, unknown>,
  ): void {
    if (!this.queue) {
      void this.agentSchedulerRunService
        .run(scheduleId, agentId, organizationId, input)
        .catch((error: unknown) =>
          this.logger.error(
            { err: error, scheduleId, agentId },
            'Synchronous-fallback scheduled agent run failed',
          ),
        );
      return;
    }

    void this.queue
      .add(
        'run_scheduled_agent',
        { kind: 'run_scheduled_agent', scheduleId, agentId, organizationId, input },
        {
          jobId: `scheduled:${scheduleId}:${Date.now()}`,
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        },
      )
      .catch((error: unknown) =>
        this.logger.error(
          { err: error, scheduleId, agentId },
          'Failed to enqueue scheduled agent run job',
        ),
      );
  }
}
