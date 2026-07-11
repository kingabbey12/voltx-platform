import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { HealthService } from '../src/modules/health/health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: { system: { $queryRaw: jest.Mock } };

  async function build(redisEnabled: boolean): Promise<HealthService> {
    prismaService = {
      system: {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: PrismaService, useValue: prismaService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'redis.enabled') return redisEnabled;
              if (key === 'redis.url') return 'redis://localhost:6399';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    return module.get<HealthService>(HealthService);
  }

  describe('when Redis is disabled', () => {
    beforeEach(async () => {
      service = await build(false);
    });

    it('returns ok status with no redis dependency reported', async () => {
      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.dependencies.database.status).toBe('up');
      expect(result.dependencies.redis).toBeUndefined();
    });

    it('is ready based on database status alone', async () => {
      const result = await service.readiness();
      expect(result.status).toBe('ready');
    });
  });

  describe('when Redis is enabled but unreachable', () => {
    beforeEach(async () => {
      service = await build(true);
    });

    afterEach(() => {
      service.onModuleDestroy();
    });

    it('reports redis as down and readiness as not_ready', async () => {
      const result = await service.readiness();

      expect(result.dependencies.redis?.status).toBe('down');
      expect(result.status).toBe('not_ready');
    }, 10000);
  });
});
