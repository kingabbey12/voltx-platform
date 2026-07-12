import { Injectable } from '@nestjs/common';
import { SupportSession, SupportSessionStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface CreateSupportSessionData {
  platformAdminUserId: string;
  targetOrganizationId: string;
  reason: string;
  supportMembershipId: string | null;
  expiresAt: Date;
}

export interface ListSupportSessionsFilter {
  status?: SupportSessionStatus;
  targetOrganizationId?: string;
  platformAdminUserId?: string;
}

/**
 * Lives in the auth module (not the platform module) for the same
 * reason SessionRepository does: JwtAccessStrategy — a core auth-module
 * piece every guarded request passes through — needs to read this table
 * directly to check an impersonation token's live status/expiry, and
 * AuthModule is @Global() so the Customer Success module (platform/
 * support-sessions/) can inject this same repository rather than
 * duplicating Prisma access.
 */
@Injectable()
export class SupportSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateSupportSessionData): Promise<SupportSession> {
    return this.prisma.system.supportSession.create({
      data: {
        platformAdminUserId: data.platformAdminUserId,
        targetOrganizationId: data.targetOrganizationId,
        reason: data.reason,
        supportMembershipId: data.supportMembershipId,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findById(id: string): Promise<SupportSession | null> {
    return this.prisma.system.supportSession.findUnique({ where: { id } });
  }

  async findActiveForAdminInOrganization(
    platformAdminUserId: string,
    targetOrganizationId: string,
  ): Promise<SupportSession | null> {
    return this.prisma.system.supportSession.findFirst({
      where: {
        platformAdminUserId,
        targetOrganizationId,
        status: SupportSessionStatus.ACTIVE,
      },
    });
  }

  async list(filter: ListSupportSessionsFilter): Promise<SupportSession[]> {
    return this.prisma.system.supportSession.findMany({
      where: {
        status: filter.status,
        targetOrganizationId: filter.targetOrganizationId,
        platformAdminUserId: filter.platformAdminUserId,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async end(id: string, endedById: string): Promise<SupportSession> {
    return this.prisma.system.supportSession.update({
      where: { id },
      data: { status: SupportSessionStatus.ENDED, endedAt: new Date(), endedById },
    });
  }

  async markExpired(id: string): Promise<SupportSession> {
    return this.prisma.system.supportSession.update({
      where: { id },
      data: { status: SupportSessionStatus.EXPIRED, endedAt: new Date() },
    });
  }
}
