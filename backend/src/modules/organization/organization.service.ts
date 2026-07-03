import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import {
  ListOrganizationsQueryDto,
  OrganizationResponseDto,
  PaginatedOrganizationsDto,
} from './dto/organization-response.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { OrganizationRepository } from './organization.repository';
import { generateUniqueOrganizationSlug } from './utils/organization-slug.util';

@Injectable()
export class OrganizationService {
  constructor(private readonly organizationRepository: OrganizationRepository) {}

  async create(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const slug = await generateUniqueOrganizationSlug(dto.name, (candidate) =>
      this.organizationRepository.isSlugTaken(candidate),
    );

    try {
      const entity = await this.organizationRepository.create({
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl,
        industry: dto.industry,
        country: dto.country,
        timezone: dto.timezone,
        status: dto.status,
        settings: dto.settings,
      });

      return OrganizationResponseDto.fromEntity(entity);
    } catch (error) {
      this.handlePrismaError(error);
      throw error;
    }
  }

  async findOne(id: string): Promise<OrganizationResponseDto> {
    const entity = await this.organizationRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }

    return OrganizationResponseDto.fromEntity(entity);
  }

  async findAll(query: ListOrganizationsQueryDto): Promise<PaginatedOrganizationsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    const result = await this.organizationRepository.findAll({
      page,
      limit,
      status: query.status,
      search: query.search,
    });

    return {
      items: result.items.map((item) => OrganizationResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdateOrganizationDto): Promise<OrganizationResponseDto> {
    try {
      const entity = await this.organizationRepository.update(id, dto);
      if (!entity) {
        throw new NotFoundException(`Organization with id "${id}" not found`);
      }

      return OrganizationResponseDto.fromEntity(entity);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      this.handlePrismaError(error);
      throw error;
    }
  }

  async remove(id: string): Promise<OrganizationResponseDto> {
    const entity = await this.organizationRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }

    return OrganizationResponseDto.fromEntity(entity);
  }

  private handlePrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Organization slug already exists');
    }
  }
}
