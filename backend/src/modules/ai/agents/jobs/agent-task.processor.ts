import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { AgentRunResumeService } from '../approvals/agent-run-resume.service';
import { AgentSchedulerRunService } from '../scheduling/agent-scheduler-run.service';
import { AGENT_TASK_QUEUE } from './agent-task-queue.constants';
import { AgentTaskJobData } from './agent-task-queue.service';

@Processor(AGENT_TASK_QUEUE)
export class AgentTaskProcessor extends WorkerHost {
  constructor(
    private readonly agentRunResumeService: AgentRunResumeService,
    private readonly agentSchedulerRunService: AgentSchedulerRunService,
  ) {
    super();
  }

  async process(job: Job<AgentTaskJobData>): Promise<void> {
    switch (job.data.kind) {
      case 'resume_after_approval':
        // AgentRunResumeService.resume already logs and never throws (a
        // background continuation failing must not itself crash the
        // worker) — no BullMQ retry/backoff wired here, matching that
        // "best-effort continuation" contract.
        await this.agentRunResumeService.resume(job.data.agentRunId, job.data.approvalId);
        return;
      case 'run_scheduled_agent':
        // Unlike resume, a scheduled run's failure IS allowed to throw —
        // BullMQ's attempts/backoff (configured at enqueue time) should
        // actually retry a transient failure here.
        await this.agentSchedulerRunService.run(
          job.data.scheduleId,
          job.data.agentId,
          job.data.organizationId,
          job.data.input,
          job.attemptsMade + 1,
        );
        return;
    }
  }
}
