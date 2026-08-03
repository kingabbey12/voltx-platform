import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import {
  EXECUTIVE_CONTEXT_INVALIDATOR,
  ExecutiveContextInvalidator,
} from '../ai/context/context.types';
import {
  CreateNotificationData,
  FindNotificationsParams,
  NotificationRepository,
  PaginatedNotifications,
} from './notification.repository';
import { NotificationEntity } from './entities/notification.entity';
import { CommsGateway } from '../communications/realtime/comms.gateway';

@Injectable()
export class NotificationService {
  constructor(
    private readonly notificationRepository: NotificationRepository,
    private readonly commsGateway: CommsGateway,
    private readonly tenantContext: TenantContextService,
    @Inject(EXECUTIVE_CONTEXT_INVALIDATOR)
    private readonly contextInvalidation: ExecutiveContextInvalidator,
  ) {}

  /**
   * The single entry point every other module should call to notify a
   * user — persists the notification, then pushes it live over the same
   * WebSocket connection comms already uses. Safe to call from anywhere
   * (background jobs, webhooks, request handlers) since it never depends
   * on the caller's own tenant context.
   */
  async create(data: CreateNotificationData): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.create(data);
    await this.contextInvalidation.invalidateSource(
      notification.organizationId,
      'notifications',
      notification.userId,
    );
    this.commsGateway.emitNotification(notification);
    return notification;
  }

  async listForCurrentUser(params: FindNotificationsParams): Promise<PaginatedNotifications> {
    return this.notificationRepository.findAllForCurrentUser(params);
  }

  async countUnreadForCurrentUser(): Promise<number> {
    return this.notificationRepository.countUnreadForCurrentUser();
  }

  async markRead(id: string): Promise<NotificationEntity> {
    const notification = await this.notificationRepository.markRead(id);
    if (!notification) {
      throw new NotFoundException(`Notification "${id}" not found`);
    }
    await this.contextInvalidation.invalidateSource(
      notification.organizationId,
      'notifications',
      notification.userId,
    );
    return notification;
  }

  async markAllRead(): Promise<number> {
    const count = await this.notificationRepository.markAllReadForCurrentUser();
    const tenant = this.tenantContext.getOrThrow();
    await this.contextInvalidation.invalidateSource(
      tenant.organizationId,
      'notifications',
      tenant.userId,
    );
    return count;
  }

  async getPreferences(): Promise<Record<string, boolean>> {
    return this.notificationRepository.getPreferencesForCurrentUser();
  }

  async updatePreferences(preferences: Record<string, boolean>): Promise<Record<string, boolean>> {
    return this.notificationRepository.updatePreferencesForCurrentUser(preferences);
  }
}
