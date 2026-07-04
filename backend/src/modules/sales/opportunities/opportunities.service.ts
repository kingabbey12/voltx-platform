import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SalesAiActionDto, SalesAiActionResponseDto } from '../dto/sales-ai.dto';
import { SalesAiService } from '../sales-ai.service';
import {
  CreateOpportunityDto,
  OpportunityResponseDto,
  PaginatedOpportunitiesDto,
  UpdateOpportunityDto,
} from './dto/opportunity.dto';
import { OpportunityEntity } from './entities/opportunity.entity';
import { OpportunitiesRepository } from './opportunities.repository';

@Injectable()
export class OpportunitiesService {
  constructor(
    private readonly opportunitiesRepository: OpportunitiesRepository,
    private readonly salesAiService: SalesAiService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateOpportunityDto): Promise<OpportunityResponseDto> {
    const entity = await this.opportunitiesRepository.create({
      companyId: dto.companyId,
      contactId: dto.contactId,
      leadId: dto.leadId,
      title: dto.title.trim(),
      stage: dto.stage,
      amount: dto.amount,
      currency: dto.currency?.trim(),
      probability: dto.probability,
      expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null,
      notes: dto.notes?.trim(),
      metadata: dto.metadata,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'sales_opportunity',
      resourceId: entity.id,
      metadata: {
        title: entity.title,
        stage: entity.stage,
      },
    });

    return OpportunityResponseDto.fromEntity(entity);
  }

  async findOne(id: string): Promise<OpportunityResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    return OpportunityResponseDto.fromEntity(entity);
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    stage?: string;
    companyId?: string;
    contactId?: string;
    leadId?: string;
  }): Promise<PaginatedOpportunitiesDto> {
    const result = await this.opportunitiesRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      stage: query.stage as OpportunityEntity['stage'] | undefined,
      companyId: query.companyId,
      contactId: query.contactId,
      leadId: query.leadId,
    });

    return {
      items: result.items.map((item) => OpportunityResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdateOpportunityDto): Promise<OpportunityResponseDto> {
    const entity = await this.opportunitiesRepository.update(id, {
      ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
      ...(dto.contactId !== undefined ? { contactId: dto.contactId } : {}),
      ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.stage !== undefined ? { stage: dto.stage } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.currency !== undefined ? { currency: dto.currency.trim() } : {}),
      ...(dto.probability !== undefined ? { probability: dto.probability } : {}),
      ...(dto.expectedCloseAt !== undefined
        ? { expectedCloseAt: dto.expectedCloseAt ? new Date(dto.expectedCloseAt) : null }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    if (!entity) {
      throw new NotFoundException(`Opportunity with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'sales_opportunity',
      resourceId: entity.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return OpportunityResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<OpportunityResponseDto> {
    const entity = await this.opportunitiesRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Opportunity with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'sales_opportunity',
      resourceId: entity.id,
    });

    return OpportunityResponseDto.fromEntity(entity);
  }

  async insights(id: string, dto: SalesAiActionDto): Promise<SalesAiActionResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    const result = await this.salesAiService.run(
      {
        title: `Opportunity insights: ${entity.title}`,
        prompt:
          'Analyze this opportunity. Summarize strengths, risks, blockers, likely objections, deal health, and what the account team should pay attention to next.',
        workspaceContext: buildOpportunityContext(entity),
        action: 'opportunity_insights',
      },
      dto,
    );

    await this.opportunitiesRepository.update(id, {
      insights: result.outputText,
    });

    await this.auditService.record({
      action: 'insights',
      resource: 'sales_opportunity',
      resourceId: entity.id,
    });

    return result;
  }

  async nextBestAction(id: string, dto: SalesAiActionDto): Promise<SalesAiActionResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    const result = await this.salesAiService.run(
      {
        title: `Next best action: ${entity.title}`,
        prompt:
          'Recommend the single best next action to advance this opportunity, explain why it matters, and suggest the exact communication or meeting step to take.',
        workspaceContext: buildOpportunityContext(entity),
        action: 'next_best_action',
      },
      dto,
    );

    await this.opportunitiesRepository.update(id, {
      nextBestAction: result.outputText,
    });

    await this.auditService.record({
      action: 'next_best_action',
      resource: 'sales_opportunity',
      resourceId: entity.id,
    });

    return result;
  }

  private async findEntityOrThrow(id: string): Promise<OpportunityEntity> {
    const entity = await this.opportunitiesRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Opportunity with id "${id}" not found`);
    }

    return entity;
  }
}

function buildOpportunityContext(entity: OpportunityEntity): string[] {
  return [
    `Opportunity: ${entity.title}`,
    `Stage: ${entity.stage}`,
    `Amount: ${entity.amount ?? 0} ${entity.currency}`,
    `Probability: ${entity.probability}%`,
    `Expected close: ${entity.expectedCloseAt?.toISOString() ?? 'Unknown'}`,
    `Company id: ${entity.companyId ?? 'Unassigned'}`,
    `Contact id: ${entity.contactId ?? 'Unassigned'}`,
    `Lead id: ${entity.leadId ?? 'Unassigned'}`,
    `Notes: ${entity.notes ?? 'None'}`,
  ];
}
