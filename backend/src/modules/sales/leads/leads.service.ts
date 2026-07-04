import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SalesAiActionDto, SalesAiActionResponseDto } from '../dto/sales-ai.dto';
import { SalesAiService } from '../sales-ai.service';
import { CreateLeadDto, LeadResponseDto, PaginatedLeadsDto, UpdateLeadDto } from './dto/lead.dto';
import { LeadEntity } from './entities/lead.entity';
import { LeadsRepository } from './leads.repository';

@Injectable()
export class LeadsService {
  constructor(
    private readonly leadsRepository: LeadsRepository,
    private readonly salesAiService: SalesAiService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateLeadDto): Promise<LeadResponseDto> {
    const entity = await this.leadsRepository.create({
      companyId: dto.companyId,
      contactId: dto.contactId,
      title: dto.title.trim(),
      source: dto.source?.trim(),
      status: dto.status,
      notes: dto.notes?.trim(),
      metadata: dto.metadata,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'sales_lead',
      resourceId: entity.id,
      metadata: {
        title: entity.title,
        status: entity.status,
      },
    });

    return LeadResponseDto.fromEntity(entity);
  }

  async findOne(id: string): Promise<LeadResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    return LeadResponseDto.fromEntity(entity);
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    status?: string;
    companyId?: string;
    contactId?: string;
  }): Promise<PaginatedLeadsDto> {
    const result = await this.leadsRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status as LeadEntity['status'] | undefined,
      companyId: query.companyId,
      contactId: query.contactId,
    });

    return {
      items: result.items.map((item) => LeadResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdateLeadDto): Promise<LeadResponseDto> {
    const entity = await this.leadsRepository.update(id, {
      ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
      ...(dto.contactId !== undefined ? { contactId: dto.contactId } : {}),
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.source !== undefined ? { source: dto.source.trim() } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    if (!entity) {
      throw new NotFoundException(`Lead with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'sales_lead',
      resourceId: entity.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return LeadResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<LeadResponseDto> {
    const entity = await this.leadsRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Lead with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'sales_lead',
      resourceId: entity.id,
    });

    return LeadResponseDto.fromEntity(entity);
  }

  async qualify(id: string, dto: SalesAiActionDto): Promise<SalesAiActionResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    const aiResult = await this.salesAiService.run(
      {
        title: `Lead qualification: ${entity.title}`,
        prompt:
          'Assess this lead for qualification. Summarize fit, urgency, key buying signals, blockers, and recommend whether to qualify, nurture, or disqualify.',
        workspaceContext: [
          `Lead title: ${entity.title}`,
          `Source: ${entity.source ?? 'Unknown'}`,
          `Status: ${entity.status}`,
          `Notes: ${entity.notes ?? 'None'}`,
          `Company id: ${entity.companyId ?? 'Unassigned'}`,
          `Contact id: ${entity.contactId ?? 'Unassigned'}`,
        ],
        action: 'lead_qualification',
      },
      dto,
    );

    const score = inferQualificationScore(aiResult.outputText);
    await this.leadsRepository.update(id, {
      qualificationScore: score,
      qualificationSummary: aiResult.outputText,
      status: inferLeadStatus(score),
    });

    await this.auditService.record({
      action: 'qualify',
      resource: 'sales_lead',
      resourceId: entity.id,
      metadata: {
        score,
        status: inferLeadStatus(score),
      },
    });

    return aiResult;
  }

  private async findEntityOrThrow(id: string): Promise<LeadEntity> {
    const entity = await this.leadsRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Lead with id "${id}" not found`);
    }

    return entity;
  }
}

function inferQualificationScore(text: string): number {
  const normalized = text.toLowerCase();
  let score = 50;
  if (
    /(high fit|strong fit|qualified|urgent|budget|timeline|champion|decision maker)/u.test(
      normalized,
    )
  ) {
    score += 30;
  }
  if (/(medium fit|nurture|exploring)/u.test(normalized)) {
    score += 10;
  }
  if (/(weak fit|disqualify|no budget|low urgency|no timeline)/u.test(normalized)) {
    score -= 25;
  }
  return Math.max(0, Math.min(100, score));
}

function inferLeadStatus(score: number): LeadEntity['status'] {
  if (score >= 70) {
    return 'QUALIFIED';
  }
  if (score <= 30) {
    return 'DISQUALIFIED';
  }
  return 'NURTURING';
}
