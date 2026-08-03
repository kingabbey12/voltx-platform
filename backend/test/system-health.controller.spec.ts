import { HttpStatus } from '@nestjs/common';
import { HealthService, ReadinessCheckResult } from '../src/modules/health/health.service';
import { SystemHealthController } from '../src/modules/health/system-health.controller';

function buildResponse(): { status: jest.Mock; json: jest.Mock } {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  return { status, json };
}

describe('SystemHealthController', () => {
  let controller: SystemHealthController;
  let healthService: { readiness: jest.Mock; liveness: jest.Mock };

  beforeEach(() => {
    healthService = {
      readiness: jest.fn(),
      liveness: jest.fn(),
    };
    controller = new SystemHealthController(healthService as unknown as HealthService);
  });

  describe('readiness', () => {
    it('returns 200 for a degraded readiness so replicas stay in rotation', async () => {
      const result: ReadinessCheckResult = {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'up', latencyMs: 1 },
          storage: { status: 'down', latencyMs: 2, error: '401 Unauthorized' },
        },
      };
      healthService.readiness.mockResolvedValue(result);
      const response = buildResponse();

      await controller.readiness(response as never);

      // 503 here would evict healthy replicas over an attachment outage.
      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(response.json).toHaveBeenCalledWith(result);
    });

    it('returns 200 when all dependencies are up', async () => {
      const result: ReadinessCheckResult = {
        status: 'ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'up', latencyMs: 1.5 },
          storage: { status: 'up', latencyMs: 1 },
        },
      };
      healthService.readiness.mockResolvedValue(result);
      const response = buildResponse();

      await controller.readiness(response as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(response.json).toHaveBeenCalledWith(result);
    });

    it('returns 503 when the database is down', async () => {
      const result: ReadinessCheckResult = {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'down', latencyMs: 3000 },
          storage: { status: 'up', latencyMs: 1 },
        },
      };
      healthService.readiness.mockResolvedValue(result);
      const response = buildResponse();

      await controller.readiness(response as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(response.json).toHaveBeenCalledWith(result);
    });

    it('returns 503 when Redis is enabled and down', async () => {
      const result: ReadinessCheckResult = {
        status: 'not_ready',
        timestamp: new Date().toISOString(),
        dependencies: {
          database: { status: 'up', latencyMs: 1.5 },
          storage: { status: 'up', latencyMs: 1 },
          redis: { status: 'down', latencyMs: 3000 },
        },
      };
      healthService.readiness.mockResolvedValue(result);
      const response = buildResponse();

      await controller.readiness(response as never);

      expect(response.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    });
  });
});
