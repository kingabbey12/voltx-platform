import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { toOrganizationEntity } from '../../organization/entities/organization.mapper';
import { OrganizationRepository } from '../../organization/organization.repository';
import {
  ListPlatformOrganizationsQueryDto,
  PaginatedPlatformOrganizationsDto,
  PlatformOrganizationDetailDto,
  PlatformOrganizationSummaryDto,
} from './dto/platform-organization.dto';

@Injectable()
export class PlatformOrganizationService {
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly prisma: PrismaService,
  ) {}

  async search(
    query: ListPlatformOrganizationsQueryDto,
  ): Promise<PaginatedPlatformOrganizationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.organizationRepository.searchUnscoped({
      page,
      limit,
      status: query.status,
      search: query.search,
    });

    const memberCounts = await Promise.all(
      result.items.map((org) =>
        this.prisma.system.membership.count({ where: { organizationId: org.id } }),
      ),
    );

    return {
      items: result.items.map((org, index) =>
        PlatformOrganizationSummaryDto.fromEntity(org, memberCounts[index]),
      ),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async getDetail(organizationId: string): Promise<PlatformOrganizationDetailDto> {
    const record = await this.prisma.system.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
    });
    if (!record) {
      throw new NotFoundException('Organization not found');
    }

    const memberCount = await this.prisma.system.membership.count({
      where: { organizationId },
    });

    return PlatformOrganizationDetailDto.fromEntity(toOrganizationEntity(record), memberCount);
  }
}
