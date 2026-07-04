import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import {
  CompanyResponseDto,
  CreateCompanyDto,
  PaginatedCompaniesDto,
  UpdateCompanyDto,
} from './dto/company.dto';
import { CompaniesRepository } from './companies.repository';

@Injectable()
export class CompaniesService {
  constructor(
    private readonly companiesRepository: CompaniesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateCompanyDto): Promise<CompanyResponseDto> {
    const entity = await this.companiesRepository.create({
      name: dto.name.trim(),
      domain: dto.domain?.trim(),
      website: dto.website?.trim(),
      industry: dto.industry?.trim(),
      status: dto.status,
      notes: dto.notes?.trim(),
      metadata: dto.metadata,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'sales_company',
      resourceId: entity.id,
      metadata: {
        name: entity.name,
        status: entity.status,
      },
    });

    return CompanyResponseDto.fromEntity(entity);
  }

  async findOne(id: string): Promise<CompanyResponseDto> {
    const entity = await this.companiesRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    return CompanyResponseDto.fromEntity(entity);
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
  }): Promise<PaginatedCompaniesDto> {
    const result = await this.companiesRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status as 'PROSPECT' | 'ACTIVE' | 'INACTIVE' | undefined,
    });

    return {
      items: result.items.map((item) => CompanyResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<CompanyResponseDto> {
    const entity = await this.companiesRepository.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.domain !== undefined ? { domain: dto.domain.trim() } : {}),
      ...(dto.website !== undefined ? { website: dto.website.trim() } : {}),
      ...(dto.industry !== undefined ? { industry: dto.industry.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    if (!entity) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'sales_company',
      resourceId: entity.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return CompanyResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<CompanyResponseDto> {
    const entity = await this.companiesRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Company with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'sales_company',
      resourceId: entity.id,
    });

    return CompanyResponseDto.fromEntity(entity);
  }
}
