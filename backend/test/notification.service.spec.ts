import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { NotificationRepository } from '../src/modules/notifications/notification.repository';
import { CommsGateway } from '../src/modules/communications/realtime/comms.gateway';
import { NotificationEntity } from '../src/modules/notifications/entities/notification.entity';

function makeNotification(overrides: Partial<NotificationEntity> = {}): NotificationEntity {
  return {
    id: 'notif-1',
    organizationId: 'org-1',
    userId: 'user-1',
    category: 'MESSAGE',
    title: 'Hello',
    body: null,
    actionUrl: null,
    metadata: {},
    read: false,
    readAt: null,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('NotificationService', () => {
  let service: NotificationService;
  let repository: jest.Mocked<NotificationRepository>;
  let commsGateway: jest.Mocked<CommsGateway>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: NotificationRepository,
          useValue: {
            create: jest.fn(),
            findAllForCurrentUser: jest.fn(),
            countUnreadForCurrentUser: jest.fn(),
            markRead: jest.fn(),
            markAllReadForCurrentUser: jest.fn(),
            getPreferencesForCurrentUser: jest.fn(),
            updatePreferencesForCurrentUser: jest.fn(),
          },
        },
        { provide: CommsGateway, useValue: { emitNotification: jest.fn() } },
      ],
    }).compile();

    service = module.get(NotificationService);
    repository = module.get(NotificationRepository);
    commsGateway = module.get(CommsGateway);
  });

  it('persists a notification and pushes it live over the comms gateway', async () => {
    const created = makeNotification();
    repository.create.mockResolvedValue(created);

    const result = await service.create({
      organizationId: 'org-1',
      userId: 'user-1',
      category: 'MESSAGE',
      title: 'Hello',
    });

    expect(result).toBe(created);
    expect(commsGateway.emitNotification).toHaveBeenCalledWith(created);
  });

  it('lists notifications for the current user via the repository', async () => {
    const page = { items: [makeNotification()], total: 1, page: 1, limit: 20, totalPages: 1 };
    repository.findAllForCurrentUser.mockResolvedValue(page);

    const result = await service.listForCurrentUser({ page: 1, limit: 20 });

    expect(result).toBe(page);
    expect(repository.findAllForCurrentUser).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('throws NotFoundException when marking a non-existent notification as read', async () => {
    repository.markRead.mockResolvedValue(null);

    await expect(service.markRead('missing-id')).rejects.toThrow(NotFoundException);
  });

  it('returns the updated notification when markRead succeeds', async () => {
    const updated = makeNotification({ read: true, readAt: new Date() });
    repository.markRead.mockResolvedValue(updated);

    const result = await service.markRead('notif-1');

    expect(result).toBe(updated);
  });

  it('delegates markAllRead to the repository and returns the affected count', async () => {
    repository.markAllReadForCurrentUser.mockResolvedValue(4);

    const result = await service.markAllRead();

    expect(result).toBe(4);
  });

  it('delegates preference reads/writes to the repository', async () => {
    repository.getPreferencesForCurrentUser.mockResolvedValue({ email: true });
    repository.updatePreferencesForCurrentUser.mockResolvedValue({ email: false });

    await expect(service.getPreferences()).resolves.toEqual({ email: true });
    await expect(service.updatePreferences({ email: false })).resolves.toEqual({ email: false });
    expect(repository.updatePreferencesForCurrentUser).toHaveBeenCalledWith({ email: false });
  });
});
