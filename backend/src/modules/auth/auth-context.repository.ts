import { MembershipStatus } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface MembershipAuthContext {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  roleKey: string;
  roleName: string;
}

@Injectable()
export class AuthContextRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveMembershipContext(
    userId: string,
    organizationId?: string,
  ): Promise<MembershipAuthContext | null> {
    const membership = await this.prisma.system.membership.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        ...(organizationId ? { organizationId } : {}),
        user: { deletedAt: null },
        organization: { deletedAt: null },
      },
      include: { role: true },
      orderBy: { joinedAt: 'asc' },
    });

    if (!membership) {
      return null;
    }

    return {
      id: membership.id,
      organizationId: membership.organizationId,
      userId: membership.userId,
      roleId: membership.roleId,
      roleKey: membership.role.key,
      roleName: membership.role.name,
    };
  }

  async userExists(userId: string): Promise<boolean> {
    const user = await this.prisma.system.user.findFirst({
      where: { id: userId, deletedAt: null },
      select: { id: true },
    });

    return user !== null;
  }
}
