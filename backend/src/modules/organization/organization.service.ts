import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
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
  constructor(
    private readonly organizationRepository: OrganizationRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    const slug = await generateUniqueOrganizationSlug(dto.name, (candidate) =>
      this.organizationRepository.isSlugTaken(candidate),
    );

    try {
      const entity = await this.organizationRepository.create({
        name: dto.name,
        slug,
        logoUrl: dto.logoUrl,
        email: dto.email,
        website: dto.website,
        industry: dto.industry,
        country: dto.country,
        state: dto.state,
        city: dto.city,
        companySize: dto.companySize,
        primaryGoals: dto.primaryGoals,
        currency: dto.currency,
        language: dto.language,
        phone: dto.phone,
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
    this.tenantContextService.assertOrganizationAccess(id);

    const entity = await this.organizationRepository.findById();
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
    this.tenantContextService.assertOrganizationAccess(id);

    try {
      const entity = await this.organizationRepository.update(dto);
      if (!entity) {
        throw new NotFoundException(`Organization with id "${id}" not found`);
      }

      await this.auditService.record({
        action: 'update',
        resource: 'organization',
        resourceId: entity.id,
        metadata: dto as Record<string, unknown>,
      });

      return OrganizationResponseDto.fromEntity(entity);
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof ForbiddenException) {
        throw error;
      }
      this.handlePrismaError(error);
      throw error;
    }
  }

  async completeOnboarding(id: string): Promise<OrganizationResponseDto> {
    this.tenantContextService.assertOrganizationAccess(id);

    const entity = await this.organizationRepository.completeOnboarding();
    if (!entity) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'complete_onboarding',
      resource: 'organization',
      resourceId: entity.id,
    });

    return OrganizationResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<OrganizationResponseDto> {
    this.tenantContextService.assertOrganizationAccess(id);

    const entity = await this.organizationRepository.softDelete();
    if (!entity) {
      throw new NotFoundException(`Organization with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'organization',
      resourceId: entity.id,
    });

    return OrganizationResponseDto.fromEntity(entity);
  }

  private handlePrismaError(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Organization slug already exists');
    }
  }
}
