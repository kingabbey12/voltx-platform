import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { NotificationCategory, NotificationEntity } from './entities/notification.entity';

export interface CreateNotificationData {
  organizationId: string;
  userId: string;
  category: NotificationCategory;
  title: string;
  body?: string;
  actionUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface FindNotificationsParams {
  page: number;
  limit: number;
  read?: boolean;
  category?: NotificationCategory;
}

export interface PaginatedNotifications {
  items: NotificationEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface UserPreferencesClient {
  findFirst(args: {
    where: Record<string, unknown>;
    select: Record<string, unknown>;
  }): Promise<{ notificationPreferences: unknown } | null>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
}

interface NotificationRecord {
  id: string;
  organizationId: string;
  userId: string;
  category: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  metadata: unknown;
  read: boolean;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationClient {
  create(args: { data: Record<string, unknown> }): Promise<NotificationRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<NotificationRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  findFirst(args: { where: Record<string, unknown> }): Promise<NotificationRecord | null>;
  update(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<NotificationRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

function toEntity(record: NotificationRecord): NotificationEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    userId: record.userId,
    category: record.category as NotificationCategory,
    title: record.title,
    body: record.body,
    actionUrl: record.actionUrl,
    metadata: (record.metadata ?? {}) as Record<string, unknown>,
    read: record.read,
    readAt: record.readAt,
    createdAt: record.createdAt,
  };
}

@Injectable()
export class NotificationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /** Explicit organizationId/userId (not TenantContextService) since notifications are frequently created for a *different* user than whoever's request/job triggered them — background jobs and webhooks have no tenant context to read from at all. */
  async create(data: CreateNotificationData): Promise<NotificationEntity> {
    const record = await this.client().create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        category: data.category,
        title: data.title,
        body: data.body,
        actionUrl: data.actionUrl,
        metadata: data.metadata ?? {},
      },
    });
    return toEntity(record);
  }

  async findAllForCurrentUser(params: FindNotificationsParams): Promise<PaginatedNotifications> {
    const tenant = this.tenantContextService.getOrThrow();
    const { page, limit, read, category } = params;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      ...(read !== undefined ? { read } : {}),
      ...(category ? { category } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.client().count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async countUnreadForCurrentUser(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().count({
      where: { organizationId: tenant.organizationId, userId: tenant.userId, read: false },
    });
  }

  async markRead(id: string): Promise<NotificationEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId, userId: tenant.userId },
    });
    if (!existing) return null;

    const record = await this.client().update({
      where: { id },
      data: { read: true, readAt: new Date() },
    });
    return toEntity(record);
  }

  async markAllReadForCurrentUser(): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const result = await this.client().updateMany({
      where: { organizationId: tenant.organizationId, userId: tenant.userId, read: false },
      data: { read: true, readAt: new Date() },
    });
    return result.count;
  }

  /**
   * Deliberately touches only the `notificationPreferences` column on User
   * directly (not routed through UsersService/UsersRepository) — those
   * own broader user-profile concerns (name/email/audit logging) that
   * have nothing to do with notification preferences; keeping this
   * self-contained avoids coupling the two modules for one JSON field.
   */
  async getPreferencesForCurrentUser(): Promise<Record<string, boolean>> {
    const tenant = this.tenantContextService.getOrThrow();
    const user = await this.userClient().findFirst({
      where: { id: tenant.userId },
      select: { notificationPreferences: true },
    });
    return (user?.notificationPreferences ?? {}) as Record<string, boolean>;
  }

  async updatePreferencesForCurrentUser(
    preferences: Record<string, boolean>,
  ): Promise<Record<string, boolean>> {
    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.getPreferencesForCurrentUser();
    const merged = { ...existing, ...preferences };
    await this.userClient().update({
      where: { id: tenant.userId },
      data: { notificationPreferences: merged },
    });
    return merged;
  }

  private client(): NotificationClient {
    return this.prisma.system.notification;
  }

  private userClient(): UserPreferencesClient {
    return this.prisma.system.user as unknown as UserPreferencesClient;
  }
}
