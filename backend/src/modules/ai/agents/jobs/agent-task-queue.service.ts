import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AgentRunResumeService } from '../approvals/agent-run-resume.service';
import { AGENT_TASK_QUEUE } from './agent-task-queue.constants';

export interface ResumeAfterApprovalJobData {
  agentRunId: string;
  approvalId: string;
}

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
    private readonly queue: Queue<ResumeAfterApprovalJobData> | null,
    private readonly agentRunResumeService: AgentRunResumeService,
  ) {}

  enqueueResumeAfterApproval(agentRunId: string, approvalId: string): void {
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
        { agentRunId, approvalId },
        { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
      )
      .catch((error: unknown) =>
        this.logger.error(
          { err: error, agentRunId, approvalId },
          'Failed to enqueue agent run resume job',
        ),
      );
  }
}
