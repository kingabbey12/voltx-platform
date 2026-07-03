import { Test, TestingModule } from '@nestjs/testing';
import { HealthService } from '../src/modules/health/health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HealthService],
    }).compile();

    service = module.get<HealthService>(HealthService);
  });

  it('returns ok status', () => {
    const result = service.check();

    expect(result.status).toBe('ok');
    expect(result.timestamp).toBeDefined();
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
