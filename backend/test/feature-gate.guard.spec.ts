import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { FeatureGateGuard } from '../src/modules/billing/guards/feature-gate.guard';
import { QuotaService } from '../src/modules/billing/quota.service';
import { REQUIRE_FEATURE_METADATA_KEY } from '../src/modules/billing/constants/require-feature-metadata.constants';

describe('FeatureGateGuard', () => {
  let guard: FeatureGateGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let quotaService: jest.Mocked<QuotaService>;

  const createContext = (currentUser?: { organizationId: string }): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ currentUser }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    quotaService = { checkQuota: jest.fn() } as never;
    guard = new FeatureGateGuard(reflector as unknown as Reflector, quotaService);
  });

  it('allows access when no @RequireFeature metadata is present', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await expect(guard.canActivate(createContext())).resolves.toBe(true);
    expect(quotaService.checkQuota).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when there is no current user', async () => {
    reflector.getAllAndOverride.mockReturnValue({ featureKey: 'ai_requests', quantity: 1 });

    await expect(guard.canActivate(createContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('allows access when the quota check passes', async () => {
    reflector.getAllAndOverride.mockReturnValue({ featureKey: 'ai_requests', quantity: 1 });
    quotaService.checkQuota.mockResolvedValue({
      allowed: true,
      featureKey: 'ai_requests',
      limit: 100,
      currentUsage: 5,
      remaining: 95,
    });

    const context = createContext({ organizationId: 'org-1' });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(quotaService.checkQuota).toHaveBeenCalledWith('org-1', 'ai_requests', 1);
  });

  it('throws a ForbiddenException carrying structured details when quota is exceeded', async () => {
    reflector.getAllAndOverride.mockReturnValue({ featureKey: 'ai_requests', quantity: 1 });
    quotaService.checkQuota.mockResolvedValue({
      allowed: false,
      featureKey: 'ai_requests',
      limit: 100,
      currentUsage: 100,
      remaining: 0,
      reason: 'QUOTA_EXCEEDED',
    });

    const context = createContext({ organizationId: 'org-1' });

    try {
      await guard.canActivate(context);
      throw new Error('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('QUOTA_EXCEEDED');
      expect(response.details).toEqual({
        featureKey: 'ai_requests',
        limit: 100,
        currentUsage: 100,
      });
    }
  });

  it('throws with SUBSCRIPTION_INACTIVE code when the subscription is not active', async () => {
    reflector.getAllAndOverride.mockReturnValue({ featureKey: 'seats', quantity: 1 });
    quotaService.checkQuota.mockResolvedValue({
      allowed: false,
      featureKey: 'seats',
      limit: null,
      currentUsage: 0,
      remaining: null,
      reason: 'SUBSCRIPTION_INACTIVE',
    });

    const context = createContext({ organizationId: 'org-1' });

    try {
      await guard.canActivate(context);
      throw new Error('expected canActivate to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      const response = (error as ForbiddenException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('SUBSCRIPTION_INACTIVE');
    }
  });

  it('reads the RequireFeature metadata key', async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    await guard.canActivate(createContext());

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(REQUIRE_FEATURE_METADATA_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });
});
