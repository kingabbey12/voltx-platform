import { Injectable, Logger } from '@nestjs/common';
import { UsageRecordRepository } from './usage-record.repository';
import { SubscriptionRepository } from './subscription.repository';
import { UsageSnapshotEntity } from './entities/usage.entity';

/**
 * Records per-event usage and answers "how much of feature X has this
 * org used in its current billing period" — modeled directly on
 * AiUsageService's shape (never-throws writer, window-based summarizer)
 * so a usage-metering failure can never fail the request it's
 * instrumenting (an AI call, a workflow run, a file upload).
 */
@Injectable()
export class UsageMeteringService {
  private readonly logger = new Logger(UsageMeteringService.name);

  constructor(
    private readonly usageRecordRepository: UsageRecordRepository,
    private readonly subscriptionRepository: SubscriptionRepository,
  ) {}

  async record(
    organizationId: string,
    featureKey: string,
    quantity = 1,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (quantity <= 0) return;

    try {
      const { periodStart, periodEnd } = await this.resolveCurrentPeriod(organizationId);
      await this.usageRecordRepository.create({
        organizationId,
        featureKey,
        quantity,
        metadata,
        periodStart,
        periodEnd,
      });
    } catch (error) {
      this.logger.error({ err: error, organizationId, featureKey }, 'Failed to record usage');
    }
  }

  /** Never throws — returns 0 on failure, mirroring AiUsageService's summarizers. */
  async getCurrentPeriodUsage(organizationId: string, featureKey: string): Promise<number> {
    try {
      const { periodStart, periodEnd } = await this.resolveCurrentPeriod(organizationId);
      return await this.usageRecordRepository.sumForPeriod(
        organizationId,
        featureKey,
        periodStart,
        periodEnd,
      );
    } catch (error) {
      this.logger.error({ err: error, organizationId, featureKey }, 'Failed to summarize usage');
      return 0;
    }
  }

  async getUsageHistory(
    organizationId: string,
    featureKey?: string,
    limit?: number,
  ): Promise<UsageSnapshotEntity[]> {
    return this.usageRecordRepository.listSnapshotsForOrganization(
      organizationId,
      featureKey,
      limit,
    );
  }

  /**
   * Aligns usage windows with the org's actual billing period (so quota
   * checks and Stripe invoicing periods agree) rather than an arbitrary
   * calendar month — falls back to the current UTC calendar month only
   * for the (should-be-unreachable) case of an organization with no
   * Subscription row at all.
   */
  private async resolveCurrentPeriod(
    organizationId: string,
  ): Promise<{ periodStart: Date; periodEnd: Date }> {
    const subscription =
      await this.subscriptionRepository.findCurrentForOrganization(organizationId);
    if (subscription) {
      return {
        periodStart: subscription.currentPeriodStart,
        periodEnd: subscription.currentPeriodEnd,
      };
    }
    return currentUtcCalendarMonth();
  }
}

function currentUtcCalendarMonth(): { periodStart: Date; periodEnd: Date } {
  const now = new Date();
  const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { periodStart, periodEnd };
}
