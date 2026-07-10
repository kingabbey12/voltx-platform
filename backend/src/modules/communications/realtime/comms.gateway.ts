import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtAccessPayload } from '../../auth/interfaces/jwt-payload.interface';
import { MessageResponseDto } from '../conversation/dto/conversation.dto';
import { CommsMessageEntity } from '../conversation/entities/message.entity';
import { NotificationEntity } from '../../notifications/entities/notification.entity';

interface AuthenticatedSocket extends Socket {
  data: { organizationId?: string; userId?: string };
}

/**
 * Real-time push for the unified inbox (new messages, delivery status,
 * typing indicators) and for the notification center (new notifications).
 * One gateway/namespace for both — the connection/auth/room-join logic is
 * entirely generic, and standing up a second gateway just to change which
 * events flow over it would be duplicate infrastructure for the same
 * concern. Auth mirrors JwtAccessStrategy's verification exactly (same
 * secret, same payload shape) but done manually since Passport's
 * AuthGuard binds to HTTP context, not WS.
 *
 * Two room scopes: `org:{organizationId}` (every member of the org — used
 * for comms events, which are visible org-wide) and `user:{userId}` (just
 * that one connection — used for notifications, which are private to the
 * recipient and must never leak to other org members sharing the socket
 * namespace).
 */
@WebSocketGateway({ namespace: 'communications', cors: { origin: true, credentials: true } })
export class CommsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(CommsGateway.name);

  // Presence is per-instance, in-memory state — correct for a single
  // backend instance (this codebase's REDIS_ENABLED-gated pattern is used
  // for durability of jobs, not for cross-instance fan-out of ephemeral
  // socket state like this). A user can have multiple sockets open
  // (multiple tabs/devices), so track a connection count per user rather
  // than a boolean, and only fire online/offline when that count crosses
  // zero.
  private readonly onlineUserConnectionCounts = new Map<string, Map<string, number>>();
  // conversationId -> userIds currently viewing it.
  private readonly conversationViewers = new Map<string, Set<string>>();

  constructor(private readonly jwtService: JwtService) {}

  handleConnection(client: AuthenticatedSocket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      client.disconnect(true);
      return;
    }

    try {
      const payload = this.jwtService.verify<JwtAccessPayload>(token);
      if (payload.type !== 'access' || !payload.org) {
        client.disconnect(true);
        return;
      }
      client.data.organizationId = payload.org;
      client.data.userId = payload.sub;
      void client.join(`org:${payload.org}`);
      void client.join(`user:${payload.sub}`);
      this.markOnline(payload.org, payload.sub);
      client.emit('presence:list', { userIds: this.onlineUsersIn(payload.org) });
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const { organizationId, userId } = client.data;
    if (organizationId && userId) {
      this.markOffline(organizationId, userId);
      this.leaveAllViewedConversations(organizationId, userId);
    }
  }

  @SubscribeMessage('conversation:typing')
  handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): void {
    if (!client.data.organizationId) return;
    client.to(`org:${client.data.organizationId}`).emit('conversation:typing', {
      conversationId: data.conversationId,
      userId: client.data.userId,
    });
  }

  /** A user opened a conversation thread — broadcasts the updated viewer list for that conversation to the rest of the org. */
  @SubscribeMessage('conversation:view')
  handleView(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): void {
    const { organizationId, userId } = client.data;
    if (!organizationId || !userId) return;

    const viewers = this.conversationViewers.get(data.conversationId) ?? new Set<string>();
    viewers.add(userId);
    this.conversationViewers.set(data.conversationId, viewers);
    this.emitToOrg(organizationId, 'conversation:viewers', {
      conversationId: data.conversationId,
      userIds: Array.from(viewers),
    });
  }

  /** A user navigated away from a conversation thread. */
  @SubscribeMessage('conversation:leave-view')
  handleLeaveView(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: { conversationId: string },
  ): void {
    const { organizationId, userId } = client.data;
    if (!organizationId || !userId) return;
    this.removeViewer(organizationId, data.conversationId, userId);
  }

  private markOnline(organizationId: string, userId: string): void {
    const counts = this.onlineUserConnectionCounts.get(organizationId) ?? new Map<string, number>();
    const previous = counts.get(userId) ?? 0;
    counts.set(userId, previous + 1);
    this.onlineUserConnectionCounts.set(organizationId, counts);

    if (previous === 0) {
      this.emitToOrg(organizationId, 'presence:online', { userId });
    }
  }

  private markOffline(organizationId: string, userId: string): void {
    const counts = this.onlineUserConnectionCounts.get(organizationId);
    if (!counts) return;
    const previous = counts.get(userId) ?? 0;
    const next = Math.max(0, previous - 1);

    if (next === 0) {
      counts.delete(userId);
      this.emitToOrg(organizationId, 'presence:offline', { userId });
    } else {
      counts.set(userId, next);
    }
  }

  private onlineUsersIn(organizationId: string): string[] {
    return Array.from(this.onlineUserConnectionCounts.get(organizationId)?.keys() ?? []);
  }

  private removeViewer(organizationId: string, conversationId: string, userId: string): void {
    const viewers = this.conversationViewers.get(conversationId);
    if (!viewers?.has(userId)) return;
    viewers.delete(userId);
    this.emitToOrg(organizationId, 'conversation:viewers', {
      conversationId,
      userIds: Array.from(viewers),
    });
  }

  private leaveAllViewedConversations(organizationId: string, userId: string): void {
    for (const conversationId of this.conversationViewers.keys()) {
      this.removeViewer(organizationId, conversationId, userId);
    }
  }

  private emitToOrg(organizationId: string, event: string, payload: unknown): void {
    this.server.to(`org:${organizationId}`).emit(event, payload);
  }

  private emitToUser(userId: string, event: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit(event, payload);
  }

  emitNewMessage(organizationId: string, message: CommsMessageEntity): void {
    this.emitToOrg(organizationId, 'message:new', MessageResponseDto.fromEntity(message));
  }

  emitMessageStatus(organizationId: string, message: CommsMessageEntity): void {
    this.emitToOrg(organizationId, 'message:status', { id: message.id, status: message.status });
  }

  /** Targets the recipient's own `user:{userId}` room, not the org room — notifications are private to their recipient. */
  emitNotification(notification: NotificationEntity): void {
    this.emitToUser(notification.userId, 'notification:new', notification);
  }
}
