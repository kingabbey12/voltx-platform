import { Injectable } from '@nestjs/common';
import { AuditRepository, CreateAuditLogData } from './audit.repository';

@Injectable()
export class AuditService {
  constructor(private readonly auditRepository: AuditRepository) {}

  async record(data: CreateAuditLogData): Promise<void> {
    await this.auditRepository.create(data);
  }
}
