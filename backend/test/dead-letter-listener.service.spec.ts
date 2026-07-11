import { ConfigService } from '@nestjs/config';

const mockGetJob = jest.fn();
const mockQueueClose = jest.fn().mockResolvedValue(undefined);
const mockEventsClose = jest.fn().mockResolvedValue(undefined);
const failedHandlers = new Map<
  string,
  (payload: { jobId: string; failedReason: string }) => void
>();

jest.mock('bullmq', () => {
  return {
    Queue: jest.fn().mockImplementation((name: string) => ({
      getJob: mockGetJob,
      close: mockQueueClose,
      name,
    })),
    QueueEvents: jest.fn().mockImplementation((name: string) => ({
      on: jest.fn(
        (event: string, handler: (payload: { jobId: string; failedReason: string }) => void) => {
          if (event === 'failed') {
            failedHandlers.set(name, handler);
          }
        },
      ),
      close: mockEventsClose,
    })),
  };
});

import { DeadLetterListenerService } from '../src/modules/background-jobs/dead-letter-listener.service';
import { BackgroundJobFailureRepository } from '../src/modules/background-jobs/background-job-failure.repository';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { AGENT_TASK_QUEUE } from '../src/modules/ai/agents/jobs/agent-task-queue.constants';

describe('DeadLetterListenerService', () => {
  let repository: jest.Mocked<BackgroundJobFailureRepository>;
  let authContextRepository: jest.Mocked<AuthContextRepository>;
  let notificationService: jest.Mocked<NotificationService>;

  function buildConfig(redisEnabled: boolean): ConfigService {
    return {
      get: jest.fn((key: string, defaultValue?: unknown) => {
        if (key === 'redis.enabled') return redisEnabled;
        if (key === 'redis.url') return 'redis://localhost:6379';
        return defaultValue;
      }),
    } as unknown as ConfigService;
  }

  function buildService(redisEnabled: boolean): DeadLetterListenerService {
    return new DeadLetterListenerService(
      buildConfig(redisEnabled),
      repository,
      authContextRepository,
      notificationService,
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    failedHandlers.clear();
    repository = { create: jest.fn().mockResolvedValue(undefined) } as never;
    authContextRepository = {
      listActiveUserIdsWithPermission: jest.fn().mockResolvedValue([]),
    } as never;
    notificationService = { create: jest.fn().mockResolvedValue(undefined) } as never;
  });

  it('does nothing when Redis is disabled', () => {
    const service = buildService(false);
    service.onModuleInit();

    expect(failedHandlers.size).toBe(0);
  });

  it('subscribes to every monitored queue when Redis is enabled', () => {
    const service = buildService(true);
    service.onModuleInit();

    expect(failedHandlers.has(AGENT_TASK_QUEUE)).toBe(true);
    expect(failedHandlers.size).toBe(4);
  });

  it('ignores a failure while retries remain', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-1',
      name: 'resume_after_approval',
      data: { organizationId: 'org-1' },
      attemptsMade: 1,
      opts: { attempts: 3 },
    });

    const service = buildService(true);
    service.onModuleInit();

    const handler = failedHandlers.get(AGENT_TASK_QUEUE)!;
    handler({ jobId: 'job-1', failedReason: 'transient error' });
    await flushMicrotasks();

    expect(repository.create).not.toHaveBeenCalled();
  });

  it('records a dead letter once retries are exhausted, attributing the organization from job data', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-1',
      name: 'resume_after_approval',
      data: { organizationId: 'org-1', agentRunId: 'run-1' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    });

    const service = buildService(true);
    service.onModuleInit();

    const handler = failedHandlers.get(AGENT_TASK_QUEUE)!;
    handler({ jobId: 'job-1', failedReason: 'permanent error' });
    await flushMicrotasks();

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        queueName: AGENT_TASK_QUEUE,
        jobName: 'resume_after_approval',
        jobId: 'job-1',
        failureReason: 'permanent error',
        attemptsMade: 3,
      }),
    );
  });

  it('attributes a null organization when the job payload carries none', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-2',
      name: 'resume_after_approval',
      data: {},
      attemptsMade: 1,
      opts: {},
    });

    const service = buildService(true);
    service.onModuleInit();

    const handler = failedHandlers.get(AGENT_TASK_QUEUE)!;
    handler({ jobId: 'job-2', failedReason: 'permanent error' });
    await flushMicrotasks();

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: null }),
    );
  });

  it('notifies every org admin holding ops.dead_letter.read once a dead letter is recorded', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-1',
      name: 'resume_after_approval',
      data: { organizationId: 'org-1' },
      attemptsMade: 3,
      opts: { attempts: 3 },
    });
    authContextRepository.listActiveUserIdsWithPermission.mockResolvedValue(['admin-1', 'admin-2']);

    const service = buildService(true);
    service.onModuleInit();

    const handler = failedHandlers.get(AGENT_TASK_QUEUE)!;
    handler({ jobId: 'job-1', failedReason: 'permanent error' });
    await flushMicrotasks();

    expect(authContextRepository.listActiveUserIdsWithPermission).toHaveBeenCalledWith(
      'org-1',
      'ops.dead_letter.read',
    );
    expect(notificationService.create).toHaveBeenCalledTimes(2);
    expect(notificationService.create).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'admin-1', category: 'WORKFLOW' }),
    );
  });

  it('skips admin notification when the organization could not be attributed', async () => {
    mockGetJob.mockResolvedValue({
      id: 'job-2',
      name: 'resume_after_approval',
      data: {},
      attemptsMade: 1,
      opts: {},
    });

    const service = buildService(true);
    service.onModuleInit();

    const handler = failedHandlers.get(AGENT_TASK_QUEUE)!;
    handler({ jobId: 'job-2', failedReason: 'permanent error' });
    await flushMicrotasks();

    expect(authContextRepository.listActiveUserIdsWithPermission).not.toHaveBeenCalled();
    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('closes every queue and queue-events client on destroy', async () => {
    const service = buildService(true);
    service.onModuleInit();

    await service.onModuleDestroy();

    expect(mockQueueClose).toHaveBeenCalled();
    expect(mockEventsClose).toHaveBeenCalled();
  });
});

function flushMicrotasks(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}
