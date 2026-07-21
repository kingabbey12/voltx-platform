import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import {
  CreatePromiseDto,
  ListPromisesQueryDto,
  PaginatedPromisesDto,
  PromiseEventResponseDto,
  PromiseResponseDto,
  TransitionPromiseDto,
  UpdatePromiseDto,
} from './dto/promise.dto';
import { PromisesRepository } from './promises.repository';
import { PromiseEntity, PromiseStatus } from './entities/promise.entity';

type TransitionAction = 'stand' | 'fulfill' | 'release' | 'break';

const TRANSITIONS: Record<TransitionAction, { from: PromiseStatus[]; to: PromiseStatus }> = {
  stand: { from: ['PROPOSED'], to: 'STANDING' },
  fulfill: { from: ['STANDING'], to: 'FULFILLED' },
  release: { from: ['PROPOSED', 'STANDING'], to: 'RELEASED' },
  break: { from: ['STANDING'], to: 'BROKEN' },
};

/**
 * Promise (docs/design/COMPANY.md §2): the central primitive — a
 * commitment between two parties with a lifecycle (proposed, standing,
 * kept, broken, released — "kept" surfaced as FULFILLED per the brief's
 * vocabulary). This is the first module built directly on the primitive
 * rather than approximated through SalesLead/SalesOpportunity.
 */
@Injectable()
export class PromisesService {
  constructor(
    private readonly promisesRepository: PromisesRepository,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreatePromiseDto, actorId: string): Promise<PromiseResponseDto> {
    for (const party of dto.parties) {
      if (Boolean(party.contactId) === Boolean(party.userId)) {
        throw new BadRequestException(
          'Each party must reference exactly one of contactId or userId.',
        );
      }
    }

    const entity = await this.promisesRepository.create({
      title: dto.title.trim(),
      ownerId: dto.ownerId,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      parties: dto.parties,
    });

    await this.promisesRepository.addEvent(entity.id, 'CREATED', actorId, {
      title: entity.title,
      ownerId: entity.ownerId,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'promise',
      resourceId: entity.id,
      metadata: { title: entity.title },
    });

    return PromiseResponseDto.fromEntity(entity);
  }

  async findOne(id: string): Promise<PromiseResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    return PromiseResponseDto.fromEntity(entity);
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    status?: ListPromisesQueryDto['status'];
    ownerId?: string;
    contactId?: string;
    contactIds?: string[];
    search?: string;
  }): Promise<PaginatedPromisesDto> {
    const result = await this.promisesRepository.findAll({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      ownerId: query.ownerId,
      contactId: query.contactId,
      contactIds: query.contactIds,
      search: query.search,
    });
    return {
      items: result.items.map((item) => PromiseResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdatePromiseDto): Promise<PromiseResponseDto> {
    if (dto.parties) {
      this.assertValidParties(dto.parties);
    }
    const entity = await this.promisesRepository.update(id, {
      ...(dto.title !== undefined ? { title: dto.title.trim() } : {}),
      ...(dto.ownerId !== undefined ? { ownerId: dto.ownerId } : {}),
      ...(dto.dueAt !== undefined ? { dueAt: dto.dueAt ? new Date(dto.dueAt) : null } : {}),
      ...(dto.parties !== undefined ? { parties: dto.parties } : {}),
    });
    if (!entity) {
      throw new NotFoundException(`Promise with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'promise',
      resourceId: entity.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return PromiseResponseDto.fromEntity(entity);
  }

  async findByContactIds(contactIds: string[], limit: number): Promise<PaginatedPromisesDto> {
    if (contactIds.length === 0) {
      return { items: [], total: 0, page: 1, limit, totalPages: 0 };
    }
    return this.findAll({ page: 1, limit, contactIds });
  }

  async transition(
    id: string,
    action: TransitionAction,
    dto: TransitionPromiseDto,
    actorId: string,
  ): Promise<PromiseResponseDto> {
    const current = await this.findEntityOrThrow(id);
    const rule = TRANSITIONS[action];

    if (!rule.from.includes(current.status)) {
      throw new BadRequestException(
        `Cannot ${action} a promise in status "${current.status}" — allowed from: ${rule.from.join(', ')}.`,
      );
    }

    const entity = await this.promisesRepository.updateStatus(id, rule.to);
    if (!entity) {
      throw new NotFoundException(`Promise with id "${id}" not found`);
    }

    await this.promisesRepository.addEvent(entity.id, 'STATUS_CHANGED', actorId, {
      from: current.status,
      to: rule.to,
      note: dto.note,
    });

    await this.auditService.record({
      action: `promise.${action}`,
      resource: 'promise',
      resourceId: entity.id,
      metadata: { from: current.status, to: rule.to },
    });

    return PromiseResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<PromiseResponseDto> {
    const entity = await this.promisesRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Promise with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'promise',
      resourceId: entity.id,
    });

    return PromiseResponseDto.fromEntity(entity);
  }

  async getEvents(id: string): Promise<PromiseEventResponseDto[]> {
    await this.findEntityOrThrow(id);
    const events = await this.promisesRepository.listEvents(id);
    return events.map((event) => PromiseEventResponseDto.fromEntity(event));
  }

  private async findEntityOrThrow(id: string): Promise<PromiseEntity> {
    const entity = await this.promisesRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Promise with id "${id}" not found`);
    }
    return entity;
  }

  private assertValidParties(parties: CreatePromiseDto['parties']): void {
    for (const party of parties) {
      if (Boolean(party.contactId) === Boolean(party.userId)) {
        throw new BadRequestException(
          'Each party must reference exactly one of contactId or userId.',
        );
      }
    }
  }
}
