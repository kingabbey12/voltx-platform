import { FEATURE_SEEDS, PLAN_SEEDS } from '../prisma/seed-billing-plans';

describe('seed-billing-plans', () => {
  it('defines exactly 5 plans', () => {
    expect(PLAN_SEEDS).toHaveLength(5);
    expect(PLAN_SEEDS.map((plan) => plan.key).sort()).toEqual([
      'business',
      'enterprise',
      'free',
      'professional',
      'starter',
    ]);
  });

  it('every plan limit references a real, seeded feature', () => {
    const featureKeys = new Set(FEATURE_SEEDS.map((feature) => feature.key));
    for (const plan of PLAN_SEEDS) {
      for (const featureKey of Object.keys(plan.limits)) {
        expect(featureKeys.has(featureKey)).toBe(true);
      }
    }
  });

  it('every plan defines a limit for every feature (no silently-unlimited gaps)', () => {
    const featureKeys = FEATURE_SEEDS.map((feature) => feature.key);
    for (const plan of PLAN_SEEDS) {
      for (const featureKey of featureKeys) {
        expect(Object.prototype.hasOwnProperty.call(plan.limits, featureKey)).toBe(true);
      }
    }
  });

  it('Enterprise is unlimited (null) on every dimension', () => {
    const enterprise = PLAN_SEEDS.find((plan) => plan.key === 'enterprise');
    expect(enterprise).toBeDefined();
    for (const limit of Object.values(enterprise!.limits)) {
      expect(limit).toBeNull();
    }
  });

  it('Free is the only plan with a $0 price and no other plan is free', () => {
    const free = PLAN_SEEDS.find((plan) => plan.key === 'free');
    expect(free?.priceMonthlyUsd).toBe(0);
    for (const plan of PLAN_SEEDS.filter((p) => p.key !== 'free' && p.key !== 'enterprise')) {
      expect(plan.priceMonthlyUsd).toBeGreaterThan(0);
    }
  });

  it('Enterprise has no fixed price ("contact us")', () => {
    const enterprise = PLAN_SEEDS.find((plan) => plan.key === 'enterprise');
    expect(enterprise?.priceMonthlyUsd).toBeNull();
    expect(enterprise?.priceYearlyUsd).toBeNull();
  });

  it('plan limits strictly increase (or stay unlimited) from Free through Business for every countable dimension', () => {
    const order = ['free', 'starter', 'professional', 'business'] as const;
    const plansByKey = new Map(PLAN_SEEDS.map((plan) => [plan.key, plan]));
    for (const featureKey of FEATURE_SEEDS.map((f) => f.key)) {
      let previous = -1;
      for (const key of order) {
        const limit = plansByKey.get(key)!.limits[featureKey];
        expect(limit).not.toBeNull();
        expect(limit as number).toBeGreaterThanOrEqual(previous);
        previous = limit as number;
      }
    }
  });
});
