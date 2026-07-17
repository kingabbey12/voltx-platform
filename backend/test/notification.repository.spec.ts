import { Test, TestingModule } from '@nestjs/testing';
import { NotificationRepository } from '../src/modules/notifications/notification.repository';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

/**
 * These tests exist primarily to lock in tenant scoping: every read/write
 * for "the current user" must be filtered by both organizationId *and*
 * userId from TenantContextService, never by userId alone (which would
 * leak another organization's notifications for the same user, e.g. after
 * an org switch) and never by organizationId alone (which would leak
 * other users' notifications within the same org).
 */
describe('NotificationRepository', () => {
  let repository: NotificationRepository;
  let notificationClient: {
    create: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    findFirst: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  let userClient: { findFirst: jest.Mock; update: jest.Mock };
  let tenantContextService: { getOrThrow: jest.Mock };

  beforeEach(async () => {
    notificationClient = {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    };
    userClient = { findFirst: jest.fn(), update: jest.fn() };
    tenantContextService = {
      getOrThrow: jest.fn().mockReturnValue({ organizationId: 'org-1', userId: 'user-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationRepository,
        {
          provide: PrismaService,
          useValue: { system: { notification: notificationClient, user: userClient } },
        },
        { provide: TenantContextService, useValue: tenantContextService },
      ],
    }).compile();

    repository = module.get(NotificationRepository);
  });

  it('creates a notification for the explicitly-given organization/user, not the tenant context', async () => {
    notificationClient.create.mockResolvedValue({
      id: 'notif-1',
      organizationId: 'org-2',
      userId: 'user-2',
      category: 'MESSAGE',
      title: 'Hi',
      body: null,
      actionUrl: null,
      metadata: {},
      read: false,
      readAt: null,
      createdAt: new Date(),
    });

    await repository.create({
      organizationId: 'org-2',
      userId: 'user-2',
      category: 'MESSAGE',
      title: 'Hi',
    });

    const [[createArgs]] = notificationClient.create.mock.calls as [
      [{ data: { organizationId: string; userId: string } }],
    ];
    expect(createArgs.data.organizationId).toBe('org-2');
    expect(createArgs.data.userId).toBe('user-2');
    expect(tenantContextService.getOrThrow).not.toHaveBeenCalled();
  });

  it('scopes findAllForCurrentUser to both organizationId and userId from tenant context', async () => {
    notificationClient.findMany.mockResolvedValue([]);
    notificationClient.count.mockResolvedValue(0);

    await repository.findAllForCurrentUser({ page: 2, limit: 10 });

    expect(notificationClient.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1' },
      skip: 10,
      take: 10,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
    expect(notificationClient.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1' },
    });
  });

  it('applies optional read/category filters on top of the tenant scope', async () => {
    notificationClient.findMany.mockResolvedValue([]);
    notificationClient.count.mockResolvedValue(0);

    await repository.findAllForCurrentUser({ page: 1, limit: 20, read: false, category: 'CRM' });

    expect(notificationClient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-1', userId: 'user-1', read: false, category: 'CRM' },
      }),
    );
  });

  it('scopes countUnreadForCurrentUser to the tenant context and unread rows only', async () => {
    notificationClient.count.mockResolvedValue(3);

    const result = await repository.countUnreadForCurrentUser();

    expect(result).toBe(3);
    expect(notificationClient.count).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', userId: 'user-1', read: false },
    });
  });

  it('returns null from markRead without updating when the notification is outside the tenant scope', async () => {
    notificationClient.findFirst.mockResolvedValue(null);

    const result = await repository.markRead('notif-in-another-org');

    expect(result).toBeNull();
    expect(notificationClient.findFirst).toHaveBeenCalledWith({
      where: { id: 'notif-in-another-org', organizationId: 'org-1', userId: 'user-1' },
    });
    expect(notificationClient.update).not.toHaveBeenCalled();
  });

  it('marks a notification read only after confirming it belongs to the current tenant', async () => {
    notificationClient.findFirst.mockResolvedValue({ id: 'notif-1' });
    notificationClient.update.mockResolvedValue({
      id: 'notif-1',
      organizationId: 'org-1',
      userId: 'user-1',
      category: 'MESSAGE',
      title: 'Hi',
      body: null,
      actionUrl: null,
      metadata: {},
      read: true,
      readAt: new Date(),
      createdAt: new Date(),
    });

    const result = await repository.markRead('notif-1');

    expect(result?.read).toBe(true);
    const [[updateArgs]] = notificationClient.update.mock.calls as [
      [{ where: { id: string }; data: { read: boolean; readAt: Date } }],
    ];
    expect(updateArgs.where).toEqual({ id: 'notif-1' });
    expect(updateArgs.data.read).toBe(true);
    expect(updateArgs.data.readAt).toBeInstanceOf(Date);
  });

  it('marks all unread notifications read, scoped to the current tenant', async () => {
    notificationClient.updateMany.mockResolvedValue({ count: 5 });

    const result = await repository.markAllReadForCurrentUser();

    expect(result).toBe(5);
    const [[updateManyArgs]] = notificationClient.updateMany.mock.calls as [
      [{ where: Record<string, unknown>; data: { read: boolean; readAt: Date } }],
    ];
    expect(updateManyArgs.where).toEqual({
      organizationId: 'org-1',
      userId: 'user-1',
      read: false,
    });
    expect(updateManyArgs.data.read).toBe(true);
    expect(updateManyArgs.data.readAt).toBeInstanceOf(Date);
  });

  it('reads notification preferences scoped to the current user only', async () => {
    userClient.findFirst.mockResolvedValue({ notificationPreferences: { email: true } });

    const result = await repository.getPreferencesForCurrentUser();

    expect(result).toEqual({ email: true });
    expect(userClient.findFirst).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { notificationPreferences: true },
    });
  });

  it('merges new preferences into existing ones rather than overwriting the whole map', async () => {
    userClient.findFirst.mockResolvedValue({
      notificationPreferences: { email: true, push: true },
    });
    userClient.update.mockResolvedValue({});

    const result = await repository.updatePreferencesForCurrentUser({ push: false });

    expect(result).toEqual({ email: true, push: false });
    expect(userClient.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { notificationPreferences: { email: true, push: false } },
    });
  });
});
