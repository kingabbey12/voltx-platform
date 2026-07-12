import { Injectable } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import {
  PlatformOrganizationRevenueDto,
  PlatformRevenueSummaryDto,
} from './dto/platform-revenue.dto';

@Injectable()
export class PlatformRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only aggregation over the existing billing tables (Subscription/
   * Plan/Payment/Invoice) — deliberately does not touch Stripe or
   * duplicate any billing-domain business logic, per the Platform
   * Console's scope boundary (see the v2.2 plan's Phase 7 risk note).
   * MRR is an estimate: `sum(plan.priceMonthlyUsd * seats)` across ACTIVE
   * subscriptions. Subscription/Plan carry no monthly-vs-yearly interval
   * column (that only exists as a Stripe price id), so a subscription
   * actually billed yearly is still counted at its monthly-equivalent
   * plan price here — a deliberate simplification, not a bug.
   */
  async getSummary(): Promise<PlatformRevenueSummaryDto> {
    const [statusGroups, activeSubscriptions, paidPayments, openInvoices] = await Promise.all([
      this.prisma.system.subscription.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.system.subscription.findMany({
        where: { status: SubscriptionStatus.ACTIVE },
        select: { seats: true, plan: { select: { priceMonthlyUsd: true } } },
      }),
      this.prisma.system.payment.aggregate({
        where: { status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true },
      }),
      this.prisma.system.invoice.aggregate({
        where: { status: InvoiceStatus.OPEN },
        _sum: { amountDue: true },
      }),
    ]);

    const estimatedMrr = activeSubscriptions.reduce((total, subscription) => {
      const monthlyPrice = Number(subscription.plan.priceMonthlyUsd ?? 0);
      return total + monthlyPrice * subscription.seats;
    }, 0);

    return {
      estimatedMonthlyRecurringRevenueUsd: estimatedMrr,
      totalRevenueCollectedUsd: Number(paidPayments._sum.amount ?? 0),
      outstandingAmountDueUsd: Number(openInvoices._sum.amountDue ?? 0),
      subscriptionsByStatus: statusGroups.map((group) => ({
        status: group.status,
        count: group._count._all,
      })),
    };
  }

  async getOrganizationRevenue(organizationId: string): Promise<PlatformOrganizationRevenueDto> {
    const [subscription, paidTotal, outstandingTotal, recentInvoices] = await Promise.all([
      this.prisma.system.subscription.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        include: { plan: { select: { name: true } } },
      }),
      this.prisma.system.payment.aggregate({
        where: { organizationId, status: PaymentStatus.SUCCEEDED },
        _sum: { amount: true },
      }),
      this.prisma.system.invoice.aggregate({
        where: { organizationId, status: InvoiceStatus.OPEN },
        _sum: { amountDue: true },
      }),
      this.prisma.system.invoice.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      organizationId,
      subscriptionStatus: subscription?.status ?? null,
      planName: subscription?.plan.name ?? null,
      seats: subscription?.seats ?? null,
      currentPeriodEnd: subscription?.currentPeriodEnd.toISOString() ?? null,
      totalPaidUsd: Number(paidTotal._sum.amount ?? 0),
      totalOutstandingUsd: Number(outstandingTotal._sum.amountDue ?? 0),
      recentInvoices: recentInvoices.map((invoice) => ({
        id: invoice.id,
        status: invoice.status,
        amountDue: Number(invoice.amountDue),
        amountPaid: Number(invoice.amountPaid),
        createdAt: invoice.createdAt.toISOString(),
      })),
    };
  }
}
