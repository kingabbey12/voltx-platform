import { Injectable, NotFoundException } from '@nestjs/common';
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
    return notification;
  }

  async markAllRead(): Promise<number> {
    return this.notificationRepository.markAllReadForCurrentUser();
  }

  async getPreferences(): Promise<Record<string, boolean>> {
    return this.notificationRepository.getPreferencesForCurrentUser();
  }

  async updatePreferences(preferences: Record<string, boolean>): Promise<Record<string, boolean>> {
    return this.notificationRepository.updatePreferencesForCurrentUser(preferences);
  }
}
