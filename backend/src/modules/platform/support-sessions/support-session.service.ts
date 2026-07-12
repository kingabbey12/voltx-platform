import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MembershipStatus, SupportSessionStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { SupportSessionRepository } from '../../auth/support-session.repository';
import { AuthService } from '../../auth/auth.service';
import { RoleRepository } from '../../roles/role.repository';
import { SupportSessionEntity, toSupportSessionEntity } from './entities/support-session.entity';
import { ListSupportSessionsQueryDto, StartSupportSessionDto } from './dto/support-session.dto';

export interface StartSupportSessionResult {
  session: SupportSessionEntity;
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
}

/**
 * Impersonation is granted at the 'admin' role level (full functional
 * access to the target org, minus permission-management mutations) —
 * the point of a support session is to reproduce/debug exactly what the
 * organization's own admin sees, not a restricted read-only view. What
 * makes this safe is total attribution: every action taken is recorded
 * under the platform admin's own real userId (never a fabricated
 * identity) with `supportSessionId` stamped on every AuditLog row (see
 * AuditRepository.write()), and PLATFORM_ADMIN_GUARDS routes remain
 * gated by the isPlatformAdmin flag regardless of which org a token
 * claims — impersonation never escalates into platform-admin actions.
 */
@Injectable()
export class SupportSessionService {
  constructor(
    private readonly supportSessionRepository: SupportSessionRepository,
    private readonly authService: AuthService,
    private readonly roleRepository: RoleRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly configService: ConfigService,
  ) {}

  async start(
    platformAdminUserId: string,
    dto: StartSupportSessionDto,
  ): Promise<StartSupportSessionResult> {
    const organization = await this.prisma.system.organization.findFirst({
      where: { id: dto.targetOrganizationId, deletedAt: null },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const existingActive = await this.supportSessionRepository.findActiveForAdminInOrganization(
      platformAdminUserId,
      dto.targetOrganizationId,
    );
    if (existingActive) {
      throw new ConflictException(
        'An active support session for this organization already exists — end it before starting another',
      );
    }

    const existingMembership = await this.prisma.system.membership.findFirst({
      where: { userId: platformAdminUserId, organizationId: dto.targetOrganizationId },
    });

    let supportMembershipId: string | null = null;
    if (!existingMembership) {
      const adminRole = await this.roleRepository.findByKeyOrThrow('admin');
      const membership = await this.prisma.system.membership.create({
        data: {
          userId: platformAdminUserId,
          organizationId: dto.targetOrganizationId,
          roleId: adminRole.id,
          status: MembershipStatus.ACTIVE,
        },
      });
      supportMembershipId = membership.id;
    } else if (existingMembership.status !== MembershipStatus.ACTIVE) {
      // A pre-existing but inactive membership must never be silently
      // reactivated as a side effect of starting a support session.
      throw new ConflictException(
        'Platform admin has a non-active membership in this organization; cannot start a support session',
      );
    }

    const durationMinutes = this.configService.get<number>(
      'customerSuccess.supportSessionDurationMinutes',
      45,
    );
    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000);

    const session = await this.supportSessionRepository.create({
      platformAdminUserId,
      targetOrganizationId: dto.targetOrganizationId,
      reason: dto.reason,
      supportMembershipId,
      expiresAt,
    });

    const tokens = await this.authService.issueImpersonationAccessToken(
      platformAdminUserId,
      dto.targetOrganizationId,
      session.id,
      durationMinutes * 60,
    );

    await this.auditService.recordWithExplicitActor({
      action: 'support_session.started',
      resource: 'support_session',
      resourceId: session.id,
      organizationId: dto.targetOrganizationId,
      userId: platformAdminUserId,
      metadata: { reason: dto.reason },
    });

    return { session: toSupportSessionEntity(session), ...tokens };
  }

  async end(id: string, endedById: string): Promise<SupportSessionEntity> {
    const session = await this.getRawOrThrow(id);
    if (session.status !== SupportSessionStatus.ACTIVE) {
      throw new ConflictException('Support session is not active');
    }

    const ended = await this.supportSessionRepository.end(id, endedById);

    if (session.supportMembershipId) {
      await this.prisma.system.membership
        .delete({ where: { id: session.supportMembershipId } })
        .catch(() => undefined);
    }

    await this.auditService.recordWithExplicitActor({
      action: 'support_session.ended',
      resource: 'support_session',
      resourceId: id,
      organizationId: session.targetOrganizationId,
      userId: endedById,
    });

    return toSupportSessionEntity(ended);
  }

  async list(filter: ListSupportSessionsQueryDto): Promise<SupportSessionEntity[]> {
    const sessions = await this.supportSessionRepository.list(filter);
    const settled = await Promise.all(
      sessions.map((session) => this.lazilyExpireRawIfNeeded(session)),
    );
    return settled.map(toSupportSessionEntity);
  }

  async getOrThrow(id: string): Promise<SupportSessionEntity> {
    return toSupportSessionEntity(await this.getRawOrThrow(id));
  }

  private async getRawOrThrow(id: string) {
    const session = await this.supportSessionRepository.findById(id);
    if (!session) {
      throw new NotFoundException('Support session not found');
    }
    return this.lazilyExpireRawIfNeeded(session);
  }

  /**
   * A SupportSession's own `expiresAt` is also embedded as the JWT's
   * `exp` claim, so the access token itself stops working the moment it
   * passes — this lazy transition only exists so the Platform Console's
   * audit-trail list reflects EXPIRED rather than showing a stale ACTIVE
   * status forever for a session nobody explicitly ended. No cron job:
   * the status flips the next time anything reads this row.
   */
  private async lazilyExpireRawIfNeeded(
    session: NonNullable<Awaited<ReturnType<SupportSessionRepository['findById']>>>,
  ) {
    if (
      session.status === SupportSessionStatus.ACTIVE &&
      session.expiresAt.getTime() <= Date.now()
    ) {
      const expired = await this.supportSessionRepository.markExpired(session.id);
      if (session.supportMembershipId) {
        await this.prisma.system.membership
          .delete({ where: { id: session.supportMembershipId } })
          .catch(() => undefined);
      }
      return expired;
    }
    return session;
  }
}
