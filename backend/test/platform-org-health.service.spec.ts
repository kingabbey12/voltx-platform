import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../src/database/prisma.service';
import { PlatformOrgHealthService } from '../src/modules/platform/org-health/platform-org-health.service';

describe('PlatformOrgHealthService', () => {
  let service: PlatformOrgHealthService;
  let prisma: {
    system: {
      organization: { findFirst: jest.Mock };
      subscription: { findFirst: jest.Mock };
      membership: { count: jest.Mock };
      backgroundJobFailure: { count: jest.Mock };
      commsMessage: { count: jest.Mock };
      auditLog: { count: jest.Mock };
    };
  };

  beforeEach(async () => {
    prisma = {
      system: {
        organization: { findFirst: jest.fn() },
        subscription: { findFirst: jest.fn() },
        membership: { count: jest.fn() },
        backgroundJobFailure: { count: jest.fn() },
        commsMessage: { count: jest.fn() },
        auditLog: { count: jest.fn() },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlatformOrgHealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PlatformOrgHealthService);
  });

  it('throws NotFoundException for an unknown organization', async () => {
    prisma.system.organization.findFirst.mockResolvedValue(null);
    await expect(service.getHealthScore('org-missing')).rejects.toThrow(NotFoundException);
  });

  it('scores 100 for a fully healthy organization', async () => {
    prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.system.subscription.findFirst.mockResolvedValue({ status: 'ACTIVE' });
    prisma.system.membership.count.mockResolvedValue(5);
    prisma.system.backgroundJobFailure.count.mockResolvedValue(0);
    prisma.system.commsMessage.count.mockResolvedValueOnce(100).mockResolvedValueOnce(0);
    prisma.system.auditLog.count.mockResolvedValue(20);

    const result = await service.getHealthScore('org-1');

    expect(result.score).toBe(100);
    expect(result.signals.every((signal) => signal.healthy)).toBe(true);
  });

  it('penalizes a canceled subscription, job failures, delivery failures, and no recent activity', async () => {
    prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.system.subscription.findFirst.mockResolvedValue({ status: 'CANCELED' });
    prisma.system.membership.count.mockResolvedValue(2);
    prisma.system.backgroundJobFailure.count.mockResolvedValue(15);
    prisma.system.commsMessage.count.mockResolvedValueOnce(100).mockResolvedValueOnce(15);
    prisma.system.auditLog.count.mockResolvedValue(0);

    const result = await service.getHealthScore('org-1');

    // 100 - 40 (subscription) - 20 (>10 job failures) - 20 (>10% comms failure) - 20 (no activity)
    expect(result.score).toBe(0);
    expect(result.signals.find((s) => s.name === 'subscription_status')?.healthy).toBe(false);
  });

  it('never scores below zero', async () => {
    prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.system.subscription.findFirst.mockResolvedValue(null);
    prisma.system.membership.count.mockResolvedValue(0);
    prisma.system.backgroundJobFailure.count.mockResolvedValue(999);
    prisma.system.commsMessage.count.mockResolvedValueOnce(10).mockResolvedValueOnce(10);
    prisma.system.auditLog.count.mockResolvedValue(0);

    const result = await service.getHealthScore('org-1');

    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  it('returns raw diagnostics for an organization', async () => {
    prisma.system.organization.findFirst.mockResolvedValue({ id: 'org-1' });
    prisma.system.subscription.findFirst.mockResolvedValue({ status: 'TRIALING' });
    prisma.system.membership.count.mockResolvedValue(3);
    prisma.system.backgroundJobFailure.count.mockResolvedValue(1);
    prisma.system.commsMessage.count.mockResolvedValueOnce(50).mockResolvedValueOnce(1);
    prisma.system.auditLog.count.mockResolvedValue(10);

    const result = await service.getDiagnostics('org-1');

    expect(result).toEqual({
      organizationId: 'org-1',
      subscriptionStatus: 'TRIALING',
      memberCount: 3,
      recentJobFailureCount: 1,
      commsDelivery: { totalMessages: 50, failedMessages: 1, failureRate: 0.02 },
      recentAuditActivityCount: 10,
    });
  });
});
