import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditExport, AuditExportFormat, AuditLog } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../../attachments/storage/storage-provider.interface';
import { AuditExportRepository } from './audit-export.repository';
import { AuditChainVerificationResult } from '../../audit/audit.repository';

const DOWNLOAD_URL_TTL_SECONDS = 60 * 15; // 15 minutes — short-lived, generated fresh on each read

function toCsv(rows: AuditLog[]): string {
  const header = [
    'id',
    'createdAt',
    'userId',
    'action',
    'resource',
    'resourceId',
    'requestId',
    'previousHash',
    'hash',
    'metadata',
  ];
  const lines = rows.map((row) =>
    [
      row.id,
      row.createdAt.toISOString(),
      row.userId,
      row.action,
      row.resource,
      row.resourceId ?? '',
      row.requestId,
      row.previousHash ?? '',
      row.hash ?? '',
      JSON.stringify(row.metadata),
    ]
      .map(csvEscape)
      .join(','),
  );
  return [header.join(','), ...lines].join('\n');
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

@Injectable()
export class AuditComplianceService {
  constructor(
    private readonly auditExportRepository: AuditExportRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async createExport(
    fromDateInput: string,
    toDateInput: string,
    format: AuditExportFormat = AuditExportFormat.JSON,
  ): Promise<{ auditExport: AuditExport; downloadUrl: string }> {
    const tenant = this.tenantContextService.getOrThrow();
    const fromDate = new Date(fromDateInput);
    const toDate = new Date(toDateInput);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) {
      throw new BadRequestException('fromDate must be a valid date on or before toDate');
    }

    const auditExport = await this.auditExportRepository.create({
      organizationId: tenant.organizationId,
      requestedBy: tenant.userId,
      fromDate,
      toDate,
      format,
    });

    try {
      const rows = await this.auditService.findByDateRange(tenant.organizationId, fromDate, toDate);
      const body = format === AuditExportFormat.CSV ? toCsv(rows) : JSON.stringify(rows, null, 2);
      const extension = format === AuditExportFormat.CSV ? 'csv' : 'json';
      const contentType = format === AuditExportFormat.CSV ? 'text/csv' : 'application/json';
      const storageKey = `compliance/audit-exports/${tenant.organizationId}/${auditExport.id}-${randomUUID()}.${extension}`;

      await this.storageProvider.upload(storageKey, Buffer.from(body, 'utf-8'), contentType);
      const completed = await this.auditExportRepository.markCompleted(
        auditExport.id,
        storageKey,
        rows.length,
      );

      await this.auditService.record({
        action: 'compliance.audit.export',
        resource: 'audit_export',
        resourceId: completed.id,
        metadata: { fromDate: fromDateInput, toDate: toDateInput, rowCount: rows.length, format },
      });

      const downloadUrl = await this.storageProvider.getSignedDownloadUrl(
        storageKey,
        DOWNLOAD_URL_TTL_SECONDS,
        `audit-export-${completed.id}.${extension}`,
      );

      return { auditExport: completed, downloadUrl };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown error generating audit export';
      await this.auditExportRepository.markFailed(auditExport.id, message);
      throw error;
    }
  }

  async getExport(id: string): Promise<{ auditExport: AuditExport; downloadUrl: string | null }> {
    const tenant = this.tenantContextService.getOrThrow();
    const auditExport = await this.auditExportRepository.findByIdInOrg(tenant.organizationId, id);
    if (!auditExport) {
      throw new NotFoundException('Audit export not found');
    }

    if (!auditExport.storageKey) {
      return { auditExport, downloadUrl: null };
    }

    const downloadUrl = await this.storageProvider.getSignedDownloadUrl(
      auditExport.storageKey,
      DOWNLOAD_URL_TTL_SECONDS,
    );
    return { auditExport, downloadUrl };
  }

  async verifyChain(): Promise<AuditChainVerificationResult> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.auditService.verifyChain(tenant.organizationId);
  }
}
