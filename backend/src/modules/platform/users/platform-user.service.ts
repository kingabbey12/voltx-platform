import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { UsersRepository } from '../../users/users.repository';
import {
  ListPlatformUsersQueryDto,
  PaginatedPlatformUsersDto,
  PlatformUserDetailDto,
  PlatformUserMembershipDto,
  PlatformUserSummaryDto,
} from './dto/platform-user.dto';

@Injectable()
export class PlatformUserService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly prisma: PrismaService,
  ) {}

  async search(query: ListPlatformUsersQueryDto): Promise<PaginatedPlatformUsersDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.usersRepository.searchUnscoped({
      page,
      limit,
      status: query.status,
      search: query.search,
    });

    return {
      items: result.items.map((entity) => PlatformUserSummaryDto.fromEntity(entity)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getDetail(userId: string): Promise<PlatformUserDetailDto> {
    const user = await this.usersRepository.findByIdUnscoped(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const memberships = await this.prisma.system.membership.findMany({
      where: { userId },
      include: { organization: true, role: true },
      orderBy: { joinedAt: 'desc' },
    });

    const membershipDtos: PlatformUserMembershipDto[] = memberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: membership.organization.name,
      organizationSlug: membership.organization.slug,
      roleName: membership.role.name,
      status: membership.status,
      joinedAt: membership.joinedAt.toISOString(),
    }));

    return PlatformUserDetailDto.fromEntityWithMemberships(user, membershipDtos);
  }
}
