import { Injectable } from '@nestjs/common';
import { AuditLog } from '@prisma/client';
import {
  AuditChainVerificationResult,
  AuditRepository,
  CreateAuditLogData,
} from './audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(data: CreateAuditLogData): Promise<void> {
    await this.auditRepository.create(data);
  }

  async recordWithExplicitActor(
    data: CreateAuditLogData & { organizationId: string; userId: string },
  ): Promise<void> {
    await this.auditRepository.createWithExplicitActor(data);
  }

  /** Used by the Compliance Center's audit export (v2.2 Phase 5). */
  async findByDateRange(organizationId: string, fromDate: Date, toDate: Date): Promise<AuditLog[]> {
    return this.auditRepository.findByDateRange(organizationId, fromDate, toDate);
  }

  /** Used by the Compliance Center's GET /compliance/audit/verify (v2.2 Phase 5). */
  async verifyChain(organizationId: string): Promise<AuditChainVerificationResult> {
    return this.auditRepository.verifyChain(organizationId);
  }
}
