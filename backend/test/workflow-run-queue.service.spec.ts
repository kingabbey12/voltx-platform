import { WorkflowRunQueueService } from '../src/modules/workflows/jobs/workflow-run-queue.service';
import { UsageMeteringService } from '../src/modules/billing/usage-metering.service';

describe('WorkflowRunQueueService', () => {
  let workflowEngineService: { executeRun: jest.Mock };
  let usageMeteringService: jest.Mocked<UsageMeteringService>;

  beforeEach(() => {
    workflowEngineService = { executeRun: jest.fn() };
    usageMeteringService = { record: jest.fn().mockResolvedValue(undefined) } as never;
  });

  describe('when Redis is disabled (queue is null)', () => {
    it('drains executeRun synchronously instead of enqueuing', async () => {
      workflowEngineService.executeRun.mockReturnValue(
        // eslint-disable-next-line require-yield, @typescript-eslint/require-await -- yield-less by design, only resolves.
        (async function* () {
          return undefined;
        })(),
      );
      const service = new WorkflowRunQueueService(
        null,
        workflowEngineService as never,
        usageMeteringService,
      );

      await service.enqueueRun('run-1', 0, ['workflow.run'], 'org-1');

      expect(workflowEngineService.executeRun).toHaveBeenCalledWith('run-1', ['workflow.run']);
    });
  });

  describe('when Redis is enabled (queue is present)', () => {
    it('enqueues with a deterministic run+version jobId instead of calling the engine directly', async () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const service = new WorkflowRunQueueService(
        queue as never,
        workflowEngineService as never,
        usageMeteringService,
      );

      await service.enqueueRun('run-1', 3, ['workflow.run'], 'org-1');

      expect(workflowEngineService.executeRun).not.toHaveBeenCalled();
      expect(queue.add).toHaveBeenCalledWith(
        'execute_run',
        { workflowRunId: 'run-1', grantedPermissions: ['workflow.run'], organizationId: 'org-1' },
        expect.objectContaining({ jobId: 'run-run-1-v3' }),
      );
    });

    it('never puts ":" in a custom jobId — BullMQ reserves it and rejects the enqueue', async () => {
      // The mock queue accepts anything, so this contract has to be
      // asserted explicitly: real BullMQ throws "Custom Id cannot contain :"
      // and the job is silently never enqueued (caught live in the
      // v1.0.0-rc1 staging smoke, where every production enqueue failed).
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const service = new WorkflowRunQueueService(
        queue as never,
        workflowEngineService as never,
        usageMeteringService,
      );

      await service.enqueueRun('run-1', 3, [], 'org-1');

      const [, , opts] = queue.add.mock.calls[0] as [string, unknown, { jobId: string }];
      expect(opts.jobId).not.toContain(':');
    });

    it('uses a different jobId for a later re-entry into the same run (a different version)', async () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const service = new WorkflowRunQueueService(
        queue as never,
        workflowEngineService as never,
        usageMeteringService,
      );

      await service.enqueueRun('run-1', 0);
      await service.enqueueRun('run-1', 1);

      const jobIds = queue.add.mock.calls.map(
        (call: unknown[]) => (call[2] as { jobId: string }).jobId,
      );
      expect(jobIds).toEqual(['run-run-1-v0', 'run-run-1-v1']);
    });
  });

  describe('usage metering', () => {
    it('records a workflow_executions usage event when an organizationId is provided', async () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const service = new WorkflowRunQueueService(
        queue as never,
        workflowEngineService as never,
        usageMeteringService,
      );

      await service.enqueueRun('run-1', 0, [], 'org-1');

      expect(usageMeteringService.record).toHaveBeenCalledWith('org-1', 'workflow_executions', 1);
    });

    it('does not record usage when no organizationId is provided', async () => {
      const queue = { add: jest.fn().mockResolvedValue(undefined) };
      const service = new WorkflowRunQueueService(
        queue as never,
        workflowEngineService as never,
        usageMeteringService,
      );

      await service.enqueueRun('run-1', 0);

      expect(usageMeteringService.record).not.toHaveBeenCalled();
    });
  });
});
