import { Injectable } from '@nestjs/common';
import { Invitation, InvitationStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { InvitationEntity, InvitationPreviewEntity } from './invitation.entity';

type InvitationWithRelations = Invitation & {
  role: { name: string };
  invitedBy: { firstName: string; lastName: string };
  organization?: { name: string };
};

const INVITATION_INCLUDE = {
  role: { select: { name: true } },
  invitedBy: { select: { firstName: true, lastName: true } },
} satisfies Prisma.InvitationInclude;

export interface CreateInvitationData {
  organizationId: string;
  email: string;
  roleId: string;
  tokenHash: string;
  invitedByUserId: string;
  expiresAt: Date;
}

export interface ListInvitationsParams {
  organizationId: string;
  page: number;
  limit: number;
  status?: InvitationStatus;
}

export interface PaginatedInvitations {
  items: InvitationEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class InvitationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateInvitationData): Promise<InvitationEntity> {
    const record = await this.prisma.system.invitation.create({
      data: {
        organizationId: data.organizationId,
        email: data.email.toLowerCase(),
        roleId: data.roleId,
        tokenHash: data.tokenHash,
        invitedByUserId: data.invitedByUserId,
        expiresAt: data.expiresAt,
      },
      include: INVITATION_INCLUDE,
    });
    return toEntity(record);
  }

  async findPendingByOrgAndEmail(
    organizationId: string,
    email: string,
  ): Promise<InvitationEntity | null> {
    const record = await this.prisma.system.invitation.findFirst({
      where: { organizationId, email: email.toLowerCase(), status: InvitationStatus.PENDING },
      include: INVITATION_INCLUDE,
    });
    return record ? toEntity(record) : null;
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<InvitationEntity | null> {
    const record = await this.prisma.system.invitation.findFirst({
      where: { id, organizationId },
      include: INVITATION_INCLUDE,
    });
    return record ? toEntity(record) : null;
  }

  async findByTokenHash(
    tokenHash: string,
  ): Promise<(InvitationEntity & { organizationName: string }) | null> {
    const record = await this.prisma.system.invitation.findUnique({
      where: { tokenHash },
      include: { ...INVITATION_INCLUDE, organization: { select: { name: true } } },
    });
    if (!record) {
      return null;
    }
    return { ...toEntity(record), organizationName: record.organization.name };
  }

  async list(params: ListInvitationsParams): Promise<PaginatedInvitations> {
    const { organizationId, page, limit, status } = params;
    const skip = (page - 1) * limit;
    const where: Prisma.InvitationWhereInput = {
      organizationId,
      ...(status ? { status } : {}),
    };

    const [records, total] = await Promise.all([
      this.prisma.system.invitation.findMany({
        where,
        include: INVITATION_INCLUDE,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.system.invitation.count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async markAccepted(id: string, acceptedByUserId: string): Promise<void> {
    await this.prisma.system.invitation.update({
      where: { id },
      data: { status: InvitationStatus.ACCEPTED, acceptedAt: new Date(), acceptedByUserId },
    });
  }

  async markRevoked(id: string): Promise<void> {
    await this.prisma.system.invitation.update({
      where: { id },
      data: { status: InvitationStatus.REVOKED, revokedAt: new Date() },
    });
  }

  async refreshTokenAndExpiry(id: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.system.invitation.update({
      where: { id },
      data: { tokenHash, expiresAt },
    });
  }
}

function toEntity(record: InvitationWithRelations): InvitationEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    email: record.email,
    roleId: record.roleId,
    roleName: record.role.name,
    status: record.status,
    invitedByUserId: record.invitedByUserId,
    invitedByName: `${record.invitedBy.firstName} ${record.invitedBy.lastName}`.trim(),
    acceptedByUserId: record.acceptedByUserId,
    expiresAt: record.expiresAt,
    acceptedAt: record.acceptedAt,
    revokedAt: record.revokedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export type { InvitationPreviewEntity };
