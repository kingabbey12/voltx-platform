import { Job } from 'bullmq';
import { WorkflowRunProcessor } from '../src/modules/workflows/jobs/workflow-run.processor';
import { WorkflowRunJobData } from '../src/modules/workflows/jobs/workflow-run-queue.service';

describe('WorkflowRunProcessor', () => {
  it('drains WorkflowEngineService.executeRun with the job’s runId and grantedPermissions', async () => {
    const workflowEngineService = {
      executeRun: jest.fn().mockReturnValue(
        // eslint-disable-next-line require-yield, @typescript-eslint/require-await -- yield-less by design, only resolves.
        (async function* () {
          return undefined;
        })(),
      ),
    };
    const processor = new WorkflowRunProcessor(workflowEngineService as never);
    const job = {
      data: { workflowRunId: 'run-1', grantedPermissions: ['workflow.run'] },
    } as unknown as Job<WorkflowRunJobData>;

    await processor.process(job);

    expect(workflowEngineService.executeRun).toHaveBeenCalledWith('run-1', ['workflow.run']);
  });

  it('propagates an error from executeRun so BullMQ retries the job', async () => {
    const workflowEngineService = {
      executeRun: jest.fn().mockReturnValue(
        // eslint-disable-next-line @typescript-eslint/require-await -- throws synchronously by design, never actually yields/awaits.
        (async function* () {
          throw new Error('step failed');

          yield;
        })(),
      ),
    };
    const processor = new WorkflowRunProcessor(workflowEngineService as never);
    const job = {
      data: { workflowRunId: 'run-1', grantedPermissions: [] },
    } as unknown as Job<WorkflowRunJobData>;

    await expect(processor.process(job)).rejects.toThrow('step failed');
  });
});
