import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { NotificationCategory } from './entities/notification.entity';
import { NotificationService } from './notification.service';
import {
  ListNotificationsQueryDto,
  MarkAllReadResponseDto,
  NotificationPreferencesDto,
  NotificationResponseDto,
  PaginatedNotificationsDto,
  UnreadCountResponseDto,
  UpdateNotificationPreferencesDto,
} from './dto/notification.dto';

@ApiTags('Notifications')
@ApiBearerAuth('JWT')
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('notification.read')
  @ApiOperation({ summary: "List the current user's notifications" })
  async list(@Query() query: ListNotificationsQueryDto): Promise<PaginatedNotificationsDto> {
    const result = await this.notificationService.listForCurrentUser({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      read: query.read,
      category: query.category as NotificationCategory | undefined,
    });
    return {
      items: result.items.map((item) => NotificationResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  @Get('unread-count')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('notification.read')
  @ApiOperation({ summary: "Count the current user's unread notifications" })
  async unreadCount(): Promise<UnreadCountResponseDto> {
    const count = await this.notificationService.countUnreadForCurrentUser();
    return { count };
  }

  @Patch(':id/read')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('notification.update')
  @ApiOperation({ summary: 'Mark one notification as read' })
  async markRead(@Param('id') id: string): Promise<NotificationResponseDto> {
    const notification = await this.notificationService.markRead(id);
    return NotificationResponseDto.fromEntity(notification);
  }

  @Post('read-all')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('notification.update')
  @ApiOperation({ summary: "Mark all of the current user's notifications as read" })
  async markAllRead(): Promise<MarkAllReadResponseDto> {
    const count = await this.notificationService.markAllRead();
    return { count };
  }

  @Get('preferences')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('notification.read')
  @ApiOperation({ summary: "Get the current user's notification category preferences" })
  async getPreferences(): Promise<NotificationPreferencesDto> {
    const preferences = await this.notificationService.getPreferences();
    return { preferences };
  }

  @Patch('preferences')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('notification.update')
  @ApiOperation({ summary: "Update the current user's notification category preferences" })
  async updatePreferences(
    @Body() dto: UpdateNotificationPreferencesDto,
  ): Promise<NotificationPreferencesDto> {
    const preferences = await this.notificationService.updatePreferences(dto.preferences);
    return { preferences };
  }
}
