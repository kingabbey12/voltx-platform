import { Injectable, NotFoundException } from '@nestjs/common';
import { ConsentRecord } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import {
  ConsentRecordRepository,
  CreateConsentRecordData,
  FindConsentHistoryParams,
} from './consent-record.repository';

@Injectable()
export class ConsentRecordService {
  constructor(
    private readonly consentRecordRepository: ConsentRecordRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  async record(data: Omit<CreateConsentRecordData, 'organizationId'>): Promise<ConsentRecord> {
    const tenant = this.tenantContextService.getOrThrow();
    const consentRecord = await this.consentRecordRepository.create({
      ...data,
      organizationId: tenant.organizationId,
    });

    await this.auditService.record({
      action: data.granted ? 'compliance.consent.grant' : 'compliance.consent.revoke',
      resource: 'consent_record',
      resourceId: consentRecord.id,
      metadata: { userId: data.userId, consentType: data.consentType },
    });

    return consentRecord;
  }

  async history(
    params: Omit<FindConsentHistoryParams, 'organizationId'>,
  ): Promise<ConsentRecord[]> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.consentRecordRepository.findHistory({
      ...params,
      organizationId: tenant.organizationId,
    });
  }

  async getOrThrow(id: string): Promise<ConsentRecord> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.consentRecordRepository.findByIdInOrg(tenant.organizationId, id);
    if (!record) {
      throw new NotFoundException('Consent record not found');
    }
    return record;
  }
}
