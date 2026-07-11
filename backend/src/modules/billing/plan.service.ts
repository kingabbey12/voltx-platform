import { Injectable, NotFoundException } from '@nestjs/common';
import { PlanRepository } from './plan.repository';
import { FeatureEntity, PlanEntity, PlanWithLimits } from './entities/plan.entity';

@Injectable()
export class PlanService {
  constructor(private readonly planRepository: PlanRepository) {}

  async listPlans(): Promise<PlanEntity[]> {
    return this.planRepository.findAllActive();
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
