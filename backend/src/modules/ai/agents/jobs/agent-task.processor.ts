import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { DeadLetterListenerService } from '../../../background-jobs/dead-letter-listener.service';
import { AgentRunResumeService } from '../approvals/agent-run-resume.service';
import { AGENT_TASK_QUEUE } from './agent-task-queue.constants';
import { ResumeAfterApprovalJobData } from './agent-task-queue.service';

@Processor(AGENT_TASK_QUEUE)
export class AgentTaskProcessor extends WorkerHost {
  constructor(
    private readonly agentRunResumeService: AgentRunResumeService,
    private readonly deadLetters: DeadLetterListenerService,
  ) {
    super();
  }

  async process(job: Job<ResumeAfterApprovalJobData>): Promise<void> {
    // AgentRunResumeService.resume already logs and never throws (a
    // background continuation failing must not itself crash the worker) —
    // no BullMQ retry/backoff wired here, matching that "best-effort
    // continuation" contract.
    await this.agentRunResumeService.resume(job.data.agentRunId, job.data.approvalId);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<ResumeAfterApprovalJobData> | undefined, error: Error): Promise<void> {
    await this.deadLetters.recordFailedJob(AGENT_TASK_QUEUE, job, error);
  }

  @OnWorkerEvent('error')
  onWorkerError(error: Error): void {
    this.deadLetters.logWorkerRedisError(AGENT_TASK_QUEUE, error);
  }
}
