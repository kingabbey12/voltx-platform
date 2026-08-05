import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DeadLetterListenerService } from '../src/modules/background-jobs/dead-letter-listener.service';
import { BackgroundJobFailureRepository } from '../src/modules/background-jobs/background-job-failure.repository';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { AGENT_TASK_QUEUE } from '../src/modules/ai/agents/jobs/agent-task-queue.constants';

describe('DeadLetterListenerService', () => {
  let repository: jest.Mocked<BackgroundJobFailureRepository>;
  let authContextRepository: jest.Mocked<AuthContextRepository>;
  let notificationService: jest.Mocked<NotificationService>;
  let service: DeadLetterListenerService;

  beforeEach(() => {
    repository = { create: jest.fn().mockResolvedValue(undefined) } as never;
    authContextRepository = {
      listActiveUserIdsWithPermission: jest.fn().mockResolvedValue([]),
    } as never;
    notificationService = { create: jest.fn().mockResolvedValue(undefined) } as never;
    service = new DeadLetterListenerService(repository, authContextRepository, notificationService);
  });

  it('ignores a worker failure that has no job payload', async () => {
    await service.recordFailedJob(AGENT_TASK_QUEUE, undefined, new Error('connection failure'));

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('ignores a failure while retries remain', async () => {
    const job = buildJob({ attemptsMade: 1, attempts: 3 });

    await service.recordFailedJob(AGENT_TASK_QUEUE, job, new Error('transient error'));

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('records a dead letter once retries are exhausted', async () => {
    const job = buildJob({
      attemptsMade: 3,
      attempts: 3,
      data: { organizationId: 'org-1', agentRunId: 'run-1' },
    });

    await service.recordFailedJob(AGENT_TASK_QUEUE, job, new Error('permanent error'));

    expect(repository.create).toHaveBeenCalledWith({
      organizationId: 'org-1',
      queueName: AGENT_TASK_QUEUE,
      jobName: 'resume_after_approval',
      jobId: 'job-1',
      payload: { organizationId: 'org-1', agentRunId: 'run-1' },
      failureReason: 'permanent error',
      attemptsMade: 3,
    });
  });

  it('attributes a null organization when the job payload carries none', async () => {
    await service.recordFailedJob(
      AGENT_TASK_QUEUE,
      buildJob({ data: {}, attemptsMade: 1, attempts: 1 }),
      new Error('permanent error'),
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: null }),
    );
  });

  it('notifies every org admin once a dead letter is recorded', async () => {
    authContextRepository.listActiveUserIdsWithPermission.mockResolvedValue(['admin-1', 'admin-2']);

    await service.recordFailedJob(
      AGENT_TASK_QUEUE,
      buildJob({
        data: { organizationId: 'org-1' },
        attemptsMade: 3,
        attempts: 3,
      }),
      new Error('permanent error'),
    );

    expect(authContextRepository.listActiveUserIdsWithPermission).toHaveBeenCalledWith(
      'org-1',
      'ops.dead_letter.read',
    );
    expect(notificationService.create).toHaveBeenCalledTimes(2);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1', category: 'WORKFLOW' }),
    );
  });

  it('does not let persistence failures escape the worker event handler', async () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    repository.create.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.recordFailedJob(
        AGENT_TASK_QUEUE,
        buildJob({ attemptsMade: 1, attempts: 1 }),
        new Error('permanent error'),
      ),
    ).resolves.toBeUndefined();
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it('logs worker Redis errors only after credential redaction', () => {
    const errorLog = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    service = new DeadLetterListenerService(
      repository,
      authContextRepository,
      notificationService,
      { errorMessage: jest.fn(() => 'AUTH [REDACTED] failed') } as never,
    );

    service.logWorkerRedisError(
      AGENT_TASK_QUEUE,
      new Error('AUTH top-secret failed at rediss://user:top-secret@redis.example.test'),
    );

    const serializedCall = JSON.stringify(errorLog.mock.calls);
    expect(serializedCall).toContain('[REDACTED]');
    expect(serializedCall).not.toContain('top-secret');
    errorLog.mockRestore();
  });
});

function buildJob(overrides: {
  data?: Record<string, unknown>;
  attemptsMade: number;
  attempts: number;
}): Job<Record<string, unknown>> {
  return {
    id: 'job-1',
    name: 'resume_after_approval',
    data: overrides.data ?? { organizationId: 'org-1' },
    attemptsMade: overrides.attemptsMade,
    opts: { attempts: overrides.attempts },
  } as Job<Record<string, unknown>>;
}
