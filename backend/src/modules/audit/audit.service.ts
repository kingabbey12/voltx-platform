import { Injectable } from '@nestjs/common';
import { AuditRepository, CreateAuditLogData } from './audit.repository';

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
}
