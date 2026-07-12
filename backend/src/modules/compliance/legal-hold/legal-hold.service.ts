import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { LegalHold, LegalHoldStatus } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import {
  CreateLegalHoldData,
  LegalHoldRepository,
  UpdateLegalHoldData,
} from './legal-hold.repository';

@Injectable()
export class LegalHoldService {
  constructor(
    private readonly legalHoldRepository: LegalHoldRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    data: Omit<CreateLegalHoldData, 'organizationId' | 'createdBy'>,
  ): Promise<LegalHold> {
    const tenant = this.tenantContextService.getOrThrow();
    const hold = await this.legalHoldRepository.create({
      ...data,
      organizationId: tenant.organizationId,
      createdBy: tenant.userId,
    });

    await this.auditService.record({
      action: 'compliance.legalhold.create',
      resource: 'legal_hold',
      resourceId: hold.id,
      metadata: { name: hold.name, targetUserId: hold.targetUserId },
    });

    return hold;
  }

  async list(): Promise<LegalHold[]> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.legalHoldRepository.listByOrganization(tenant.organizationId);
  }

  async getOrThrow(id: string): Promise<LegalHold> {
    const tenant = this.tenantContextService.getOrThrow();
    const hold = await this.legalHoldRepository.findByIdInOrg(tenant.organizationId, id);
    if (!hold) {
      throw new NotFoundException('Legal hold not found');
    }
    return hold;
  }

  async update(id: string, data: UpdateLegalHoldData): Promise<LegalHold> {
    const existing = await this.getOrThrow(id);
    if (existing.status !== LegalHoldStatus.ACTIVE) {
      throw new ConflictException('Cannot update a released legal hold');
    }

    const updated = await this.legalHoldRepository.update(id, data);
    await this.auditService.record({
      action: 'compliance.legalhold.update',
      resource: 'legal_hold',
      resourceId: id,
    });
    return updated;
  }

  async release(id: string): Promise<LegalHold> {
    const existing = await this.getOrThrow(id);
    if (existing.status !== LegalHoldStatus.ACTIVE) {
      throw new ConflictException('Legal hold is already released');
    }

    const tenant = this.tenantContextService.getOrThrow();
    const released = await this.legalHoldRepository.release(id, tenant.userId);

    await this.auditService.record({
      action: 'compliance.legalhold.release',
      resource: 'legal_hold',
      resourceId: id,
    });

    return released;
  }
}
