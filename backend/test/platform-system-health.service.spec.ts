import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { HealthService } from '../src/modules/health/health.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { PlatformSystemHealthService } from '../src/modules/platform/system-health/platform-system-health.service';

describe('PlatformSystemHealthService', () => {
  let service: PlatformSystemHealthService;
  let healthService: jest.Mocked<HealthService>;
  let metricsService: jest.Mocked<MetricsService>;
  let prisma: {
    system: { backgroundJobFailure: { groupBy: jest.Mock }; commsMessage: { count: jest.Mock } };
  };

  beforeEach(async () => {
    prisma = {
      system: {
        backgroundJobFailure: { groupBy: jest.fn() },
        commsMessage: { count: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformSystemHealthService,
        { provide: HealthService, useValue: { check: jest.fn() } },
        { provide: MetricsService, useValue: { getQueueDepths: jest.fn() } },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(PlatformSystemHealthService);
    healthService = module.get(HealthService);
    metricsService = module.get(MetricsService);
  });

  it('aggregates dependency status, queue backlogs with recent failure counts, and comms delivery health', async () => {
    healthService.check.mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 123,
      dependencies: {
        database: { status: 'up', latencyMs: 1 },
        redis: { status: 'up', latencyMs: 2 },
      },
    });
    metricsService.getQueueDepths.mockResolvedValue({
      'agent-task-queue': { waiting: 2, active: 1, failed: 0, delayed: 0 },
    });
    prisma.system.backgroundJobFailure.groupBy.mockResolvedValue([
      { queueName: 'agent-task-queue', _count: { _all: 4 } },
    ]);
    prisma.system.commsMessage.count.mockResolvedValueOnce(100).mockResolvedValueOnce(5);

    const result = await service.getSystemHealth();

    expect(result.dependencies.database.status).toBe('up');
    expect(result.queues).toEqual([
      {
        queue: 'agent-task-queue',
        depth: { waiting: 2, active: 1, failed: 0, delayed: 0 },
        recentFailureCount: 4,
      },
    ]);
    expect(result.commsDelivery).toEqual({
      totalMessages: 100,
      failedMessages: 5,
      failureRate: 0.05,
    });
  });

  it('reports a zero failure rate when there are no comms messages in the window', async () => {
    healthService.check.mockResolvedValue({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 1,
      dependencies: { database: { status: 'up', latencyMs: 1 } },
    });
    metricsService.getQueueDepths.mockResolvedValue({});
    prisma.system.backgroundJobFailure.groupBy.mockResolvedValue([]);
    prisma.system.commsMessage.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);

    const result = await service.getSystemHealth();

    expect(result.commsDelivery.failureRate).toBe(0);
    expect(result.queues).toEqual([]);
  });
});
