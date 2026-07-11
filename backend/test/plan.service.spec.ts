import { NotFoundException } from '@nestjs/common';
import { PlanService } from '../src/modules/billing/plan.service';
import { PlanRepository } from '../src/modules/billing/plan.repository';

describe('PlanService', () => {
  let planRepository: jest.Mocked<PlanRepository>;
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
    service = new PlanService(planRepository);
  });

  it('lists active plans', async () => {
    planRepository.findAllActive.mockResolvedValue([{ id: 'plan-1', key: 'free' } as never]);

    const result = await service.listPlans();

    expect(result).toHaveLength(1);
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
