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
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Socket.IO cleans up room membership automatically on disconnect.
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
