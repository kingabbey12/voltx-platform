import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { CACHE_SERVICE, CacheService } from '../cache/cache.service';
import { PlanRepository } from './plan.repository';
import { FeatureEntity, PlanEntity, PlanWithLimits } from './entities/plan.entity';

const PLAN_CATALOG_CACHE_KEY = 'billing:plan-catalog';
const PLAN_CATALOG_CACHE_TTL_MS = 5 * 60 * 1000;

@Injectable()
export class PlanService {
  constructor(
    private readonly planRepository: PlanRepository,
    @Inject(CACHE_SERVICE) private readonly cacheService: CacheService,
  ) {}

  /**
   * v2.2 Platform Scale — the plan catalog changes only via direct seed/
   * admin DB work, never through any in-app mutation, so a short TTL with
   * no invalidation wiring is the whole cache-correctness story here.
   */
  async listPlans(): Promise<PlanEntity[]> {
    const cached = await this.cacheService.get<PlanEntity[]>(PLAN_CATALOG_CACHE_KEY);
    if (cached) {
      return cached;
    }
    const plans = await this.planRepository.findAllActive();
    await this.cacheService.set(PLAN_CATALOG_CACHE_KEY, plans, PLAN_CATALOG_CACHE_TTL_MS);
    return plans;
  }

  async listFeatures(): Promise<FeatureEntity[]> {
    return this.planRepository.listFeatures();
  }

  async getPlanByKeyOrThrow(key: string): Promise<PlanEntity> {
    const plan = await this.planRepository.findByKey(key);
    if (!plan) {
      throw new NotFoundException(`Plan "${key}" not found`);
    }
    return plan;
  }

  async getPlanByIdOrThrow(id: string): Promise<PlanEntity> {
    const plan = await this.planRepository.findById(id);
    if (!plan) {
      throw new NotFoundException(`Plan with id "${id}" not found`);
    }
    return plan;
  }

  async getPlanWithLimitsOrThrow(id: string): Promise<PlanWithLimits> {
    const plan = await this.planRepository.findByIdWithLimits(id);
    if (!plan) {
      throw new NotFoundException(`Plan with id "${id}" not found`);
    }
    return plan;
  }

  async getPlanWithLimitsByKeyOrThrow(key: string): Promise<PlanWithLimits> {
    const plan = await this.planRepository.findByKeyWithLimits(key);
    if (!plan) {
      throw new NotFoundException(`Plan "${key}" not found`);
    }
    return plan;
  }

  async findByStripePriceId(stripePriceId: string): Promise<PlanEntity | null> {
    return this.planRepository.findByStripePriceId(stripePriceId);
  }
}
