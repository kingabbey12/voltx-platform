import { INestApplication } from '@nestjs/common';
import { NotificationCategory } from '@prisma/client';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { NotificationResponseDto } from '../src/modules/notifications/dto/notification.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

describe('NotificationsController (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function seedNotification(
    organizationId: string,
    userId: string,
    overrides: {
      title?: string;
      read?: boolean;
      category?: NotificationCategory;
      createdAt?: Date;
    } = {},
  ) {
    return prisma.system.notification.create({
      data: {
        organizationId,
        userId,
        category: overrides.category ?? NotificationCategory.MESSAGE,
        title: overrides.title ?? 'You have a new message',
        read: overrides.read ?? false,
        ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
      },
    });
  }

  it('lists only the current user notifications, newest first, with an accurate unread count', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');
    const base = new Date('2026-01-01T00:00:00.000Z');
    await seedNotification(owner.organization.id, owner.user.id, {
      title: 'First',
      createdAt: new Date(base.getTime()),
    });
    await seedNotification(owner.organization.id, owner.user.id, {
      title: 'Second',
      createdAt: new Date(base.getTime() + 1000),
    });
    await seedNotification(owner.organization.id, owner.user.id, {
      title: 'Already read',
      read: true,
      createdAt: new Date(base.getTime() + 2000),
    });

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);

    const body = (
      listResponse.body as ApiSuccessResponse<{
        items: NotificationResponseDto[];
        total: number;
      }>
    ).data;
    expect(body.total).toBe(3);
    expect(body.items.map((item) => item.title)).toEqual(['Already read', 'Second', 'First']);

    const unreadResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);
    expect((unreadResponse.body as ApiSuccessResponse<{ count: number }>).data.count).toBe(2);
  });

  it('marks a single notification read and reflects it in the unread count', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');
    const notification = await seedNotification(owner.organization.id, owner.user.id);

    const markResponse = await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notification.id}/read`)
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);
    expect((markResponse.body as ApiSuccessResponse<NotificationResponseDto>).data.read).toBe(true);

    const unreadResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);
    expect((unreadResponse.body as ApiSuccessResponse<{ count: number }>).data.count).toBe(0);
  });

  it('marks every unread notification read via read-all', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');
    await seedNotification(owner.organization.id, owner.user.id, { title: 'A' });
    await seedNotification(owner.organization.id, owner.user.id, { title: 'B' });

    const response = await request(app.getHttpServer())
      .post('/api/v1/notifications/read-all')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(201);
    expect((response.body as ApiSuccessResponse<{ count: number }>).data.count).toBe(2);

    const unreadResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);
    expect((unreadResponse.body as ApiSuccessResponse<{ count: number }>).data.count).toBe(0);
  });

  it('reads and updates notification preferences by merging into the existing map', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const initial = await request(app.getHttpServer())
      .get('/api/v1/notifications/preferences')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);
    expect(
      (initial.body as ApiSuccessResponse<{ preferences: Record<string, boolean> }>).data
        .preferences,
    ).toEqual({});

    const updated = await request(app.getHttpServer())
      .patch('/api/v1/notifications/preferences')
      .set(bearerAuthHeaders(owner.accessToken))
      .send({ preferences: { email: false } })
      .expect(200);
    expect(
      (updated.body as ApiSuccessResponse<{ preferences: Record<string, boolean> }>).data
        .preferences,
    ).toEqual({ email: false });
  });

  it("never lets one organization see, count, or mark-read another organization's notifications", async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'owner');
    const orgB = await authenticateContext(app, prisma, usersRepository, 'owner', {
      email: 'owner-b@example.com',
    });

    const notificationInA = await seedNotification(orgA.organization.id, orgA.user.id, {
      title: 'Org A only',
    });

    const listAsB = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    expect(
      (listAsB.body as ApiSuccessResponse<{ items: NotificationResponseDto[] }>).data.items,
    ).toHaveLength(0);

    const unreadAsB = await request(app.getHttpServer())
      .get('/api/v1/notifications/unread-count')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    expect((unreadAsB.body as ApiSuccessResponse<{ count: number }>).data.count).toBe(0);

    // Org B can't mark org A's notification as read — it's invisible to them, so a 404, not a 200.
    await request(app.getHttpServer())
      .patch(`/api/v1/notifications/${notificationInA.id}/read`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/notifications').expect(401);
  });
});
