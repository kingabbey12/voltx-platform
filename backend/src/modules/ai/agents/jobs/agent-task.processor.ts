import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AgentRunResumeService } from '../approvals/agent-run-resume.service';
import { AGENT_TASK_QUEUE } from './agent-task-queue.constants';
import { ResumeAfterApprovalJobData } from './agent-task-queue.service';

@Processor(AGENT_TASK_QUEUE)
export class AgentTaskProcessor extends WorkerHost {
  constructor(private readonly agentRunResumeService: AgentRunResumeService) {
    super();
  }

  async process(job: Job<ResumeAfterApprovalJobData>): Promise<void> {
    // AgentRunResumeService.resume already logs and never throws (a
    // background continuation failing must not itself crash the worker) —
    // no BullMQ retry/backoff wired here, matching that "best-effort
    // continuation" contract.
    await this.agentRunResumeService.resume(job.data.agentRunId, job.data.approvalId);
  }
}
