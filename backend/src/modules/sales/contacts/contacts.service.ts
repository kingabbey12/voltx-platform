import { Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { SalesAiActionDto, SalesAiActionResponseDto } from '../dto/sales-ai.dto';
import {
  ContactResponseDto,
  CreateContactDto,
  PaginatedContactsDto,
  UpdateContactDto,
} from './dto/contact.dto';
import { ContactsRepository } from './contacts.repository';
import { ContactEntity } from './entities/contact.entity';
import { SalesAiService } from '../sales-ai.service';

@Injectable()
export class ContactsService {
  constructor(
    private readonly contactsRepository: ContactsRepository,
    private readonly salesAiService: SalesAiService,
    private readonly auditService: AuditService,
  ) {}

  async create(dto: CreateContactDto): Promise<ContactResponseDto> {
    const entity = await this.contactsRepository.create({
      companyId: dto.companyId,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      email: dto.email?.trim(),
      phone: dto.phone?.trim(),
      jobTitle: dto.jobTitle?.trim(),
      notes: dto.notes?.trim(),
      metadata: dto.metadata,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'sales_contact',
      resourceId: entity.id,
      metadata: {
        fullName: fullName(entity),
      },
    });

    return ContactResponseDto.fromEntity(entity);
  }

  async findOne(id: string): Promise<ContactResponseDto> {
    const entity = await this.findEntityOrThrow(id);
    return ContactResponseDto.fromEntity(entity);
  }

  async findAll(query: {
    page: number;
    limit: number;
    search?: string;
    companyId?: string;
  }): Promise<PaginatedContactsDto> {
    const result = await this.contactsRepository.findAll(query);
    return {
      items: result.items.map((item) => ContactResponseDto.fromEntity(item)),
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  async update(id: string, dto: UpdateContactDto): Promise<ContactResponseDto> {
    const entity = await this.contactsRepository.update(id, {
      ...(dto.companyId !== undefined ? { companyId: dto.companyId } : {}),
      ...(dto.firstName !== undefined ? { firstName: dto.firstName.trim() } : {}),
      ...(dto.lastName !== undefined ? { lastName: dto.lastName.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim() } : {}),
      ...(dto.phone !== undefined ? { phone: dto.phone.trim() } : {}),
      ...(dto.jobTitle !== undefined ? { jobTitle: dto.jobTitle.trim() } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    if (!entity) {
      throw new NotFoundException(`Contact with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'update',
      resource: 'sales_contact',
      resourceId: entity.id,
      metadata: dto as unknown as Record<string, unknown>,
    });

    return ContactResponseDto.fromEntity(entity);
  }

  async remove(id: string): Promise<ContactResponseDto> {
    const entity = await this.contactsRepository.softDelete(id);
    if (!entity) {
      throw new NotFoundException(`Contact with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'sales_contact',
      resourceId: entity.id,
    });

    return ContactResponseDto.fromEntity(entity);
  }

  async draftEmail(id: string, dto: SalesAiActionDto): Promise<SalesAiActionResponseDto> {
    const entity = await this.findEntityOrThrow(id);

    return this.salesAiService.run(
      {
        title: `Sales email draft: ${fullName(entity)}`,
        prompt: `Draft a concise, personalized sales follow-up email for ${fullName(entity)}. Include a clear subject line, customer-specific value proposition, and a low-friction call to action.`,
        workspaceContext: [
          `Contact: ${fullName(entity)}`,
          `Email: ${entity.email ?? 'Unknown'}`,
          `Phone: ${entity.phone ?? 'Unknown'}`,
          `Job title: ${entity.jobTitle ?? 'Unknown'}`,
          `Company id: ${entity.companyId ?? 'Unassigned'}`,
          `Notes: ${entity.notes ?? 'None'}`,
        ],
        action: 'draft_email',
      },
      dto,
    );
  }

  private async findEntityOrThrow(id: string): Promise<ContactEntity> {
    const entity = await this.contactsRepository.findById(id);
    if (!entity) {
      throw new NotFoundException(`Contact with id "${id}" not found`);
    }

    return entity;
  }
}

function fullName(entity: ContactEntity): string {
  return `${entity.firstName} ${entity.lastName}`.trim();
}
