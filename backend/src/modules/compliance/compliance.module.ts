import { Module } from '@nestjs/common';
import { StorageModule } from '../attachments/storage/storage.module';
import { AuditComplianceController } from './audit-compliance/audit-compliance.controller';
import { AuditComplianceService } from './audit-compliance/audit-compliance.service';
import { AuditExportRepository } from './audit-compliance/audit-export.repository';
import { ConsentRecordController } from './consent-record/consent-record.controller';
import { ConsentRecordRepository } from './consent-record/consent-record.repository';
import { ConsentRecordService } from './consent-record/consent-record.service';
import { GdprController } from './gdpr/gdpr.controller';
import { GdprService } from './gdpr/gdpr.service';
import { LegalHoldController } from './legal-hold/legal-hold.controller';
import { LegalHoldRepository } from './legal-hold/legal-hold.repository';
import { LegalHoldService } from './legal-hold/legal-hold.service';
import { PiiRegistryService } from './pii/pii-registry.service';
import { RetentionPolicyController } from './retention-policy/retention-policy.controller';
import { RetentionPolicyRepository } from './retention-policy/retention-policy.repository';
import { RetentionPolicyService } from './retention-policy/retention-policy.service';

/**
 * v2.2 Compliance Center. AuditModule (hash-chain writes, findByDateRange,
 * verifyChain) is @Global() and already available everywhere, so it isn't
 * re-imported here. StorageModule is imported directly (not the whole
 * AttachmentsModule) since GDPR/audit exports only need STORAGE_PROVIDER,
 * reusing the exact same S3-compatible abstraction attachments use.
 */
@Module({
  imports: [StorageModule],
  controllers: [
    GdprController,
    LegalHoldController,
    RetentionPolicyController,
    ConsentRecordController,
    AuditComplianceController,
  ],
  providers: [
    PiiRegistryService,
    GdprService,
    LegalHoldRepository,
    LegalHoldService,
    RetentionPolicyRepository,
    RetentionPolicyService,
    ConsentRecordRepository,
    ConsentRecordService,
    AuditExportRepository,
    AuditComplianceService,
  ],
  exports: [LegalHoldRepository],
})
export class ComplianceModule {}
