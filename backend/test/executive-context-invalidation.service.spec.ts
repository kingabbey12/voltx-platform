import { ExecutiveContextInvalidationService } from '../src/modules/ai/context/context.service';
import { CacheService } from '../src/modules/cache/cache.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';

describe('ExecutiveContextInvalidationService', () => {
  let invalidateTag: jest.Mock;
  let metricsService: jest.Mocked<Pick<MetricsService, 'recordExecutiveContextInvalidation'>>;
  let service: ExecutiveContextInvalidationService;

  beforeEach(() => {
    invalidateTag = jest.fn().mockResolvedValue(undefined);
    metricsService = { recordExecutiveContextInvalidation: jest.fn() };
    service = new ExecutiveContextInvalidationService(
      { invalidateTag } as unknown as CacheService,
      metricsService as unknown as MetricsService,
    );
  });

  it('invalidates tenant, user, and source-scoped entries deterministically', async () => {
    await service.invalidateTenant('tenant-1');
    await service.invalidateUser('tenant-1', 'user-1');
    await service.invalidateSource('tenant-1', 'finance');
    await service.invalidateSource('tenant-1', 'notifications', 'user-1');

    expect(invalidateTag).toHaveBeenNthCalledWith(1, 'executive-context:tenant:tenant-1');
    expect(invalidateTag).toHaveBeenNthCalledWith(2, 'executive-context:user:tenant-1:user-1');
    expect(invalidateTag).toHaveBeenNthCalledWith(3, 'executive-context:source:tenant-1:finance');
    expect(invalidateTag).toHaveBeenNthCalledWith(
      4,
      'executive-context:source:tenant-1:user-1:notifications',
    );
    expect(metricsService.recordExecutiveContextInvalidation).toHaveBeenCalledWith(
      'tenant',
      'success',
    );
  });

  it('does not make a committed mutation fail when cache invalidation is unavailable', async () => {
    invalidateTag.mockRejectedValueOnce(new Error('Redis unavailable'));

    await expect(service.invalidateSource('tenant-1', 'crm')).resolves.toBeUndefined();
    expect(metricsService.recordExecutiveContextInvalidation).toHaveBeenCalledWith(
      'source',
      'failure',
    );
  });
});
