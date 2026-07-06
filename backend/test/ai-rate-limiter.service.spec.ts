import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AiRateLimiterService } from '../src/modules/ai/gateway/ai-rate-limiter.service';

describe('AiRateLimiterService', () => {
  async function buildService(requestsPerMinute: number): Promise<AiRateLimiterService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiRateLimiterService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(requestsPerMinute),
          },
        },
      ],
    }).compile();

    return module.get(AiRateLimiterService);
  }

  it('allows requests within the configured limit', async () => {
    const service = await buildService(2);

    expect(() => service.assertWithinLimit('org-1')).not.toThrow();
    expect(() => service.assertWithinLimit('org-1')).not.toThrow();
  });

  it('throws once an organization exceeds its limit within the window', async () => {
    const service = await buildService(1);

    expect(() => service.assertWithinLimit('org-1')).not.toThrow();
    expect(() => service.assertWithinLimit('org-1')).toThrow();
  });

  it('tracks limits independently per organization', async () => {
    const service = await buildService(1);

    expect(() => service.assertWithinLimit('org-1')).not.toThrow();
    expect(() => service.assertWithinLimit('org-2')).not.toThrow();
  });
});
