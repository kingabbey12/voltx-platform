import { Injectable, Logger } from '@nestjs/common';
import { SubscriptionRepository } from './subscription.repository';
import { PlanService } from './plan.service';
import { UsageMeteringService } from './usage-metering.service';
import { SeatAssignmentService } from './seat-assignment.service';
import { QuotaCheckResult } from './entities/quota.entity';
import { SubscriptionStatus } from './entities/subscription.entity';

/** A subscription in any of these statuses can still consume metered/seat features; anything else (PAST_DUE, CANCELED, UNPAID, PAUSED, INCOMPLETE) is blocked. */
const ACTIVE_STATUSES: SubscriptionStatus[] = ['TRIALING', 'ACTIVE'];

/**
 * The single place "is this org allowed to do X right now" gets decided —
 * consumed by FeatureGateGuard (via @RequireFeature) for count-based
 * checks, and called directly wherever the request quantity is only known
 * after some parsing the guard can't see (e.g. an uploaded file's byte
 * size, known only once multipart parsing has happened).
 */
@Injectable()
export class QuotaService {
  private readonly logger = new Logger(QuotaService.name);

  constructor(
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly planService: PlanService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly seatAssignmentService: SeatAssignmentService,
  ) {}

  async checkQuota(
    organizationId: string,
    featureKey: string,
    requestedQuantity = 1,
  ): Promise<QuotaCheckResult> {
    const subscription =
      await this.subscriptionRepository.findCurrentForOrganization(organizationId);

    if (!subscription) {
      // Every real registration creates a Subscription row (see
      // AuthService.register) — an organization with none is a
      // pre-billing/legacy fixture, not evidence of an inactive paid
      // plan, so this fails open rather than blocking every gated
      // endpoint for every organization billing was never wired into.
      this.logger.warn(
        { organizationId, featureKey },
        'No subscription found for organization — allowing by default',
      );
      return { allowed: true, featureKey, limit: null, currentUsage: 0, remaining: null };
    }

    if (!ACTIVE_STATUSES.includes(subscription.status)) {
      return {
        allowed: false,
        featureKey,
        limit: null,
        currentUsage: 0,
        remaining: null,
        reason: 'SUBSCRIPTION_INACTIVE',
      };
    }

    if (featureKey === 'seats') {
      const availability = await this.seatAssignmentService.getAvailability(organizationId);
      const allowed = availability.available >= requestedQuantity;
      return {
        allowed,
        featureKey,
        limit: availability.limit,
        currentUsage: availability.used,
        remaining: availability.available,
        reason: allowed ? undefined : 'QUOTA_EXCEEDED',
      };
    }

    const plan = await this.planService.getPlanWithLimitsOrThrow(subscription.planId);
    const featureLimit = plan.limits.find((limit) => limit.featureKey === featureKey);
    const limit = featureLimit?.limit ?? null;
    const currentUsage = await this.usageMeteringService.getCurrentPeriodUsage(
      organizationId,
      featureKey,
    );
    const allowed = limit === null || currentUsage + requestedQuantity <= limit;

    return {
      allowed,
      featureKey,
      limit,
      currentUsage,
      remaining: limit === null ? null : Math.max(0, limit - currentUsage),
      reason: allowed ? undefined : 'QUOTA_EXCEEDED',
    };
  }
}
