import { NotFoundException } from '@nestjs/common';
import { PlanService } from '../src/modules/billing/plan.service';
import { PlanRepository } from '../src/modules/billing/plan.repository';
import { CacheService } from '../src/modules/cache/cache.service';

describe('PlanService', () => {
  let planRepository: jest.Mocked<PlanRepository>;
  let cacheService: jest.Mocked<CacheService>;
  let service: PlanService;

  beforeEach(() => {
    planRepository = {
      findAllActive: jest.fn(),
      findByKey: jest.fn(),
      findById: jest.fn(),
      findByIdWithLimits: jest.fn(),
      findByKeyWithLimits: jest.fn(),
      listFeatures: jest.fn(),
      findFeatureByKey: jest.fn(),
    } as never;
    cacheService = {
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn(),
      invalidateKey: jest.fn(),
      invalidateTag: jest.fn(),
    } as never;
    service = new PlanService(planRepository, cacheService);
  });

  it('lists active plans and caches the catalog', async () => {
    planRepository.findAllActive.mockResolvedValue([{ id: 'plan-1', key: 'free' } as never]);

    const result = await service.listPlans();

    expect(result).toHaveLength(1);
    expect(cacheService.set).toHaveBeenCalledWith(
      'billing:plan-catalog',
      result,
      expect.any(Number),
    );
  });

  it('returns the cached catalog without touching the repository on a cache hit', async () => {
    const cachedPlans = [{ id: 'plan-1', key: 'free' } as never];
    cacheService.get.mockResolvedValue(cachedPlans);

    const result = await service.listPlans();

    expect(result).toBe(cachedPlans);
    expect(planRepository.findAllActive).not.toHaveBeenCalled();
  });

  it('throws NotFoundException for an unknown plan key', async () => {
    planRepository.findByKey.mockResolvedValue(null);

    await expect(service.getPlanByKeyOrThrow('nonexistent')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns the plan when the key exists', async () => {
    const plan = { id: 'plan-1', key: 'professional' } as never;
    planRepository.findByKey.mockResolvedValue(plan);

    const result = await service.getPlanByKeyOrThrow('professional');

    expect(result).toBe(plan);
  });

  it('throws NotFoundException for an unknown plan id', async () => {
    planRepository.findById.mockResolvedValue(null);

    await expect(service.getPlanByIdOrThrow('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws NotFoundException when fetching limits for an unknown plan id', async () => {
    planRepository.findByIdWithLimits.mockResolvedValue(null);

    await expect(service.getPlanWithLimitsOrThrow('missing-id')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('returns plan limits by key', async () => {
    const planWithLimits = {
      id: 'plan-1',
      key: 'starter',
      limits: [{ featureKey: 'ai_requests', limit: 500, softLimitPercent: null }],
    } as never;
    planRepository.findByKeyWithLimits.mockResolvedValue(planWithLimits);

    const result = await service.getPlanWithLimitsByKeyOrThrow('starter');

    expect(result).toBe(planWithLimits);
  });
});
