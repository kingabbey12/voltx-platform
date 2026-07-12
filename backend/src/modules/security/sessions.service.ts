import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { SessionRecord, SessionRepository } from '../auth/session.repository';
import { LoginHistoryQueryDto, PaginatedSessionsDto, SessionResponseDto } from './dto/session.dto';

function toSessionResponseDto(record: SessionRecord): SessionResponseDto {
  return {
    id: record.id,
    deviceFingerprint: record.deviceFingerprint,
    ipAddress: record.ipAddress,
    userAgent: record.userAgent,
    lastActiveAt: record.lastActiveAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
  };
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionRepository: SessionRepository,
    private readonly auditService: AuditService,
  ) {}

  async listActive(userId: string, organizationId: string): Promise<SessionResponseDto[]> {
    const sessions = await this.sessionRepository.listActiveForUserInOrganization(
      userId,
      organizationId,
    );
    return sessions.map(toSessionResponseDto);
  }

  async loginHistory(
    userId: string,
    organizationId: string,
    query: LoginHistoryQueryDto,
  ): Promise<PaginatedSessionsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.sessionRepository.listAllForUserInOrganizationPaginated(
      userId,
      organizationId,
      page,
      limit,
    );

    return {
      items: items.map(toSessionResponseDto),
      total,
      page,
      limit,
    };
  }

  async revoke(sessionId: string, userId: string, organizationId: string): Promise<void> {
    const session = await this.sessionRepository.findByIdForUserInOrganization(
      sessionId,
      userId,
      organizationId,
    );
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (session.revokedAt) {
      throw new ForbiddenException('Session already revoked');
    }

    await this.sessionRepository.revoke(sessionId);
    await this.auditService.record({
      action: 'session.revoked',
      resource: 'session',
      resourceId: sessionId,
    });
  }
}
