import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { HealthService } from '../src/modules/health/health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaService: { system: { $queryRaw: jest.Mock } };

  beforeEach(async () => {
    prismaService = {
      system: {
        $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: prismaService,
        },
      ],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('returns ok status', async () => {
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
    expect(result.dependencies.database.status).toBe('up');
  });
});
