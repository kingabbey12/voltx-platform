import { Injectable, NotFoundException } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { OrgDiagnosticsDto, OrgHealthScoreDto, OrgHealthSignalDto } from './dto/org-health.dto';

const RECENT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const HEALTHY_SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIALING,
];

/**
 * Read-only, deterministic 0-100 "customer health score" for a single
 * organization — a support/Customer-Success aid, not a new monitoring
 * system. Every signal is read from tables that already exist (billing
 * Subscription, BackgroundJobFailure, CommsMessage, AuditLog); nothing
 * new is collected. The scoring weights are a starting heuristic,
 * documented inline, not a claim of statistical rigor.
 */
@Injectable()
export class PlatformOrgHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealthScore(organizationId: string): Promise<OrgHealthScoreDto> {
    await this.assertOrganizationExists(organizationId);
    const diagnostics = await this.getDiagnosticsData(organizationId);

    const signals: OrgHealthSignalDto[] = [];

    const subscriptionHealthy =
      diagnostics.subscriptionStatus !== null &&
      HEALTHY_SUBSCRIPTION_STATUSES.includes(diagnostics.subscriptionStatus as SubscriptionStatus);
    signals.push({
      name: 'subscription_status',
      healthy: subscriptionHealthy,
      detail: diagnostics.subscriptionStatus ?? 'no subscription',
      scorePenalty: subscriptionHealthy ? 0 : 40,
    });

    const jobFailurePenalty =
      diagnostics.recentJobFailureCount > 10 ? 20 : diagnostics.recentJobFailureCount > 0 ? 10 : 0;
    signals.push({
      name: 'background_job_failures_7d',
      healthy: jobFailurePenalty === 0,
      detail: `${diagnostics.recentJobFailureCount} failure(s) in the last 7 days`,
      scorePenalty: jobFailurePenalty,
    });

    const failureRate = diagnostics.commsDelivery.failureRate;
    const commsPenalty = failureRate > 0.1 ? 20 : failureRate > 0.02 ? 10 : 0;
    signals.push({
      name: 'comms_delivery_failure_rate_7d',
      healthy: commsPenalty === 0,
      detail: `${(failureRate * 100).toFixed(1)}% failure rate over ${diagnostics.commsDelivery.totalMessages} message(s)`,
      scorePenalty: commsPenalty,
    });

    const activityPenalty = diagnostics.recentAuditActivityCount === 0 ? 20 : 0;
    signals.push({
      name: 'audit_activity_7d',
      healthy: activityPenalty === 0,
      detail: `${diagnostics.recentAuditActivityCount} audited action(s) in the last 7 days`,
      scorePenalty: activityPenalty,
    });

    const score = Math.max(
      0,
      100 - signals.reduce((total, signal) => total + signal.scorePenalty, 0),
    );

    return { organizationId, score, signals };
  }

  async getDiagnostics(organizationId: string): Promise<OrgDiagnosticsDto> {
    await this.assertOrganizationExists(organizationId);
    return this.getDiagnosticsData(organizationId);
  }

  private async assertOrganizationExists(organizationId: string): Promise<void> {
    const organization = await this.prisma.system.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
  }

  private async getDiagnosticsData(organizationId: string): Promise<OrgDiagnosticsDto> {
    const since = new Date(Date.now() - RECENT_WINDOW_MS);

    const [
      subscription,
      memberCount,
      recentJobFailureCount,
      totalMessages,
      failedMessages,
      recentAuditActivityCount,
    ] = await Promise.all([
      this.prisma.system.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      }),
      this.prisma.system.membership.count({ where: { organizationId } }),
      this.prisma.system.backgroundJobFailure.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
      this.prisma.system.commsMessage.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
      this.prisma.system.commsMessage.count({
        where: { organizationId, createdAt: { gte: since }, status: 'FAILED' },
      }),
      this.prisma.system.auditLog.count({
        where: { organizationId, createdAt: { gte: since } },
      }),
    ]);

    return {
      organizationId,
      subscriptionStatus: subscription?.status ?? null,
      memberCount,
      recentJobFailureCount,
      commsDelivery: {
        totalMessages,
        failedMessages,
        failureRate: totalMessages === 0 ? 0 : failedMessages / totalMessages,
      },
      recentAuditActivityCount,
    };
  }
}
