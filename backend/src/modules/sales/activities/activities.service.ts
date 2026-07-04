import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SalesAiActionDto, SalesAiActionResponseDto } from '../dto/sales-ai.dto';
import { SalesAiService } from '../sales-ai.service';
import {
  ActivityResponseDto,
  CreateActivityDto,
  PaginatedActivitiesDto,
  UpdateActivityDto,
} from './dto/activity.dto';
import { ActivitiesRepository } from './activities.repository';
import { ActivityEntity } from './entities/activity.entity';

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly activitiesRepository: ActivitiesRepository,
    private readonly salesAiService: SalesAiService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateActivityDto): Promise<ActivityResponseDto> {
    const entity = await this.activitiesRepository.create({
      companyId: dto.companyId,
      contactId: dto.contactId,
      leadId: dto.leadId,
      opportunityId: dto.opportunityId,
      type: dto.type,
      subject: dto.subject.trim(),
      description: dto.description?.trim(),
      occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      completed: dto.completed,
      metadata: dto.metadata,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'sales_activity',
      resourceId: entity.id,
      metadata: {
        subject: entity.subject,
        type: entity.type,
      },
    });

    return ActivityResponseDto.fromEntity(entity);
  }

  async findOne(id: string): Promise<ActivityResponseDto> {
    return ActivityResponseDto.fromEntity(await this.findEntityOrThrow(id));
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    type?: string;
    completed?: boolean;
    companyId?: string;
    contactId?: string;
    leadId?: string;
    opportunityId?: string;
  }): Promise<PaginatedActivitiesDto> {
    const result = await this.activitiesRepository.findAll({
      page: query.page,
      limit: query.limit,
      search: query.search,
      type: query.type as ActivityEntity['type'] | undefined,
      completed: query.completed,
      companyId: query.companyId,
      contactId: query.contactId,
      leadId: query.leadId,
      opportunityId: query.opportunityId,
    });

    return {
      items: result.items.map((item) => ActivityResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdateActivityDto): Promise<ActivityResponseDto> {
    const entity = await this.activitiesRepository.update(id, {
      ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
      ...(dto.contactId !== undefined ? { contactId: dto.contactId } : {}),
      ...(dto.leadId !== undefined ? { leadId: dto.leadId } : {}),
      ...(dto.opportunityId !== undefined ? { opportunityId: dto.opportunityId } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.subject !== undefined ? { subject: dto.subject.trim() } : {}),
      ...(dto.description !== undefined ? { description: dto.description.trim() } : {}),
      ...(dto.occurredAt !== undefined
        ? { occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : null }
        : {}),
      ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
      ...(dto.completed !== undefined ? { completed: dto.completed } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    if (!entity) {
      throw new NotFoundException(`Activity with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'sales_activity',
      resourceId: entity.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return ActivityResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<ActivityResponseDto> {
    const entity = await this.activitiesRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Activity with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'sales_activity',
      resourceId: entity.id,
    });

    return ActivityResponseDto.fromEntity(entity);
  }

  async summarizeMeeting(id: string, dto: SalesAiActionDto): Promise<SalesAiActionResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    const result = await this.salesAiService.run(
      {
        title: `Meeting summary: ${entity.subject}`,
        prompt:
          'Summarize this customer meeting. Provide concise recap bullets, customer priorities, risks, commitments, and recommended follow-up actions.',
        workspaceContext: [
          `Activity type: ${entity.type}`,
          `Subject: ${entity.subject}`,
          `Description: ${entity.description ?? 'None'}`,
          `Occurred at: ${entity.occurredAt?.toISOString() ?? 'Unknown'}`,
          `Completed: ${entity.completed}`,
          `Opportunity id: ${entity.opportunityId ?? 'Unassigned'}`,
          `Lead id: ${entity.leadId ?? 'Unassigned'}`,
          `Contact id: ${entity.contactId ?? 'Unassigned'}`,
        ],
        action: 'meeting_summary',
      },
      dto,
    );

    await this.activitiesRepository.update(id, {
      meetingSummary: result.outputText,
    });

    await this.auditService.record({
      action: 'meeting_summary',
      resource: 'sales_activity',
      resourceId: entity.id,
    });

    return result;
  }

  private async findEntityOrThrow(id: string): Promise<ActivityEntity> {
    const entity = await this.activitiesRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Activity with id "${id}" not found`);
    }

    return entity;
  }
}
