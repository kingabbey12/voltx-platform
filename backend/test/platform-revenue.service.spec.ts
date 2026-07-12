import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { PlatformRevenueService } from '../src/modules/platform/revenue/platform-revenue.service';

describe('PlatformRevenueService', () => {
  let service: PlatformRevenueService;
  let prisma: {
    system: {
      subscription: { groupBy: jest.Mock; findMany: jest.Mock; findFirst: jest.Mock };
      payment: { aggregate: jest.Mock };
      invoice: { aggregate: jest.Mock; findMany: jest.Mock };
    };
  };

  beforeEach(async () => {
    prisma = {
      system: {
        subscription: { groupBy: jest.fn(), findMany: jest.fn(), findFirst: jest.fn() },
        payment: { aggregate: jest.fn() },
        invoice: { aggregate: jest.fn(), findMany: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformRevenueService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PlatformRevenueService);
  });

  it('estimates MRR as sum(plan.priceMonthlyUsd * seats) across ACTIVE subscriptions', async () => {
    prisma.system.subscription.groupBy.mockResolvedValue([
      { status: 'ACTIVE', _count: { _all: 3 } },
      { status: 'CANCELED', _count: { _all: 1 } },
    ]);
    prisma.system.subscription.findMany.mockResolvedValue([
      { seats: 5, plan: { priceMonthlyUsd: 10 } },
      { seats: 2, plan: { priceMonthlyUsd: 25 } },
    ]);
    prisma.system.payment.aggregate.mockResolvedValue({ _sum: { amount: 1500 } });
    prisma.system.invoice.aggregate.mockResolvedValue({ _sum: { amountDue: 300 } });

    const result = await service.getSummary();

    expect(result.estimatedMonthlyRecurringRevenueUsd).toBe(5 * 10 + 2 * 25);
    expect(result.totalRevenueCollectedUsd).toBe(1500);
    expect(result.outstandingAmountDueUsd).toBe(300);
    expect(result.subscriptionsByStatus).toEqual([
      { status: 'ACTIVE', count: 3 },
      { status: 'CANCELED', count: 1 },
    ]);
  });

  it('returns zeroed aggregates when there is no billing data at all', async () => {
    prisma.system.subscription.groupBy.mockResolvedValue([]);
    prisma.system.subscription.findMany.mockResolvedValue([]);
    prisma.system.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.system.invoice.aggregate.mockResolvedValue({ _sum: { amountDue: null } });

    const result = await service.getSummary();

    expect(result.estimatedMonthlyRecurringRevenueUsd).toBe(0);
    expect(result.totalRevenueCollectedUsd).toBe(0);
    expect(result.outstandingAmountDueUsd).toBe(0);
  });

  it("returns a single organization's revenue detail", async () => {
    prisma.system.subscription.findFirst.mockResolvedValue({
      status: 'ACTIVE',
      seats: 4,
      currentPeriodEnd: new Date('2026-08-01T00:00:00.000Z'),
      plan: { name: 'Professional' },
    });
    prisma.system.payment.aggregate.mockResolvedValue({ _sum: { amount: 400 } });
    prisma.system.invoice.aggregate.mockResolvedValue({ _sum: { amountDue: 50 } });
    prisma.system.invoice.findMany.mockResolvedValue([
      {
        id: 'inv-1',
        status: 'PAID',
        amountDue: 100,
        amountPaid: 100,
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ]);

    const result = await service.getOrganizationRevenue('org-1');

    expect(result.subscriptionStatus).toBe('ACTIVE');
    expect(result.planName).toBe('Professional');
    expect(result.seats).toBe(4);
    expect(result.totalPaidUsd).toBe(400);
    expect(result.totalOutstandingUsd).toBe(50);
    expect(result.recentInvoices).toHaveLength(1);
  });

  it('returns nulls for an organization with no subscription at all', async () => {
    prisma.system.subscription.findFirst.mockResolvedValue(null);
    prisma.system.payment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    prisma.system.invoice.aggregate.mockResolvedValue({ _sum: { amountDue: null } });
    prisma.system.invoice.findMany.mockResolvedValue([]);

    const result = await service.getOrganizationRevenue('org-no-sub');

    expect(result.subscriptionStatus).toBeNull();
    expect(result.planName).toBeNull();
    expect(result.currentPeriodEnd).toBeNull();
  });
});
