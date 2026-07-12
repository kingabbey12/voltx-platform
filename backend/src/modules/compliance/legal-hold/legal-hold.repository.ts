import { Injectable } from '@nestjs/common';
import { LegalHold, LegalHoldStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateLegalHoldData {
  organizationId: string;
  name: string;
  reason: string;
  targetUserId?: string;
  scope?: Record<string, unknown>;
  createdBy: string;
}

export interface UpdateLegalHoldData {
  name?: string;
  reason?: string;
  scope?: Record<string, unknown>;
}

@Injectable()
export class LegalHoldRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateLegalHoldData): Promise<LegalHold> {
    return this.prisma.legalHold.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        reason: data.reason,
        targetUserId: data.targetUserId,
        scope: (data.scope ?? {}) as Prisma.InputJsonValue,
        createdBy: data.createdBy,
      },
    });
  }

  async listByOrganization(organizationId: string): Promise<LegalHold[]> {
    return this.prisma.legalHold.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<LegalHold | null> {
    return this.prisma.legalHold.findFirst({ where: { id, organizationId } });
  }

  async update(id: string, data: UpdateLegalHoldData): Promise<LegalHold> {
    return this.prisma.legalHold.update({
      where: { id },
      data: {
        name: data.name,
        reason: data.reason,
        scope: data.scope ? (data.scope as Prisma.InputJsonValue) : undefined,
      },
    });
  }

  async release(id: string, releasedBy: string): Promise<LegalHold> {
    return this.prisma.legalHold.update({
      where: { id },
      data: { status: LegalHoldStatus.RELEASED, releasedBy, releasedAt: new Date() },
    });
  }

  /** Used by GdprService to block erasure — an ACTIVE hold targeting this
   * user (or an org-wide hold with no specific target) must stop deletion. */
  async findActiveForUser(organizationId: string, userId: string): Promise<LegalHold | null> {
    return this.prisma.legalHold.findFirst({
      where: {
        organizationId,
        status: LegalHoldStatus.ACTIVE,
        OR: [{ targetUserId: userId }, { targetUserId: null }],
      },
    });
  }
}
