import { Injectable } from '@nestjs/common';
import { AuditExport, AuditExportFormat, AuditExportStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

export interface CreateAuditExportData {
  organizationId: string;
  requestedBy: string;
  fromDate: Date;
  toDate: Date;
  format: AuditExportFormat;
}

@Injectable()
export class AuditExportRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAuditExportData): Promise<AuditExport> {
    return this.prisma.auditExport.create({
      data: {
        organizationId: data.organizationId,
        requestedBy: data.requestedBy,
        fromDate: data.fromDate,
        toDate: data.toDate,
        format: data.format,
        status: AuditExportStatus.PROCESSING,
      },
    });
  }

  async markCompleted(id: string, storageKey: string, rowCount: number): Promise<AuditExport> {
    return this.prisma.auditExport.update({
      where: { id },
      data: {
        status: AuditExportStatus.COMPLETED,
        storageKey,
        rowCount,
        completedAt: new Date(),
      },
    });
  }

  async markFailed(id: string, errorMessage: string): Promise<AuditExport> {
    return this.prisma.auditExport.update({
      where: { id },
      data: { status: AuditExportStatus.FAILED, errorMessage },
    });
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<AuditExport | null> {
    return this.prisma.auditExport.findFirst({ where: { id, organizationId } });
  }

  async listByOrganization(organizationId: string): Promise<AuditExport[]> {
    return this.prisma.auditExport.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
