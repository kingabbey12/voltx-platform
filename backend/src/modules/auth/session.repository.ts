import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface SessionRecord {
  id: string;
  userId: string;
  organizationId: string;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  lastActiveAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface CreateSessionData {
  userId: string;
  organizationId: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Lives in the auth module (not the security module) because it's created
 * and touched directly by AuthService.login()/refresh() — the same
 * placement precedent as RefreshTokenRepository. The Security Center's
 * session-management endpoints (list/revoke, `src/modules/security/`)
 * inject this repository directly rather than duplicating Prisma access,
 * since AuthModule is @Global() and exports it.
 */
@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSessionData): Promise<SessionRecord> {
    return this.prisma.session.create({
      data: {
        userId: data.userId,
        organizationId: data.organizationId,
        deviceFingerprint: data.deviceFingerprint,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
      },
    });
  }

  async findActiveById(id: string): Promise<SessionRecord | null> {
    return this.prisma.session.findFirst({
      where: { id, revokedAt: null },
    });
  }

  async touchLastActiveAt(id: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { id, revokedAt: null },
      data: { lastActiveAt: new Date() },
    });
  }

  async listActiveForUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<SessionRecord[]> {
    return this.prisma.session.findMany({
      where: { userId, organizationId, revokedAt: null },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  /** "Login history" — every session (active and revoked) for the user,
   * newest first. A Session row is created exactly once per successful
   * login, so this needs no separate audit-log mechanism. */
  async listAllForUserInOrganizationPaginated(
    userId: string,
    organizationId: string,
    page: number,
    limit: number,
  ): Promise<{ items: SessionRecord[]; total: number }> {
    const [items, total] = await Promise.all([
      this.prisma.session.findMany({
        where: { userId, organizationId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.session.count({ where: { userId, organizationId } }),
    ]);
    return { items, total };
  }

  async findByIdForUserInOrganization(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<SessionRecord | null> {
    return this.prisma.session.findFirst({
      where: { id, userId, organizationId },
    });
  }

  /** Revokes the session and cascades into every refresh token issued
   * under it, in a single transaction — this is what makes a session
   * revoke immediately reject that device's next refresh attempt. */
  async revoke(id: string): Promise<void> {
    await this.prisma.runInTransaction(async (tx) => {
      await tx.session.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async revokeAllForUserInOrganization(userId: string, organizationId: string): Promise<void> {
    const activeSessions = await this.prisma.session.findMany({
      where: { userId, organizationId, revokedAt: null },
      select: { id: true },
    });

    await this.prisma.runInTransaction(async (tx) => {
      const now = new Date();
      await tx.session.updateMany({
        where: { userId, organizationId, revokedAt: null },
        data: { revokedAt: now },
      });
      await tx.refreshToken.updateMany({
        where: { sessionId: { in: activeSessions.map((session) => session.id) } },
        data: { revokedAt: now },
      });
    });
  }
}
