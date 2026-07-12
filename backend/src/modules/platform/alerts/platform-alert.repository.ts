import { Injectable } from '@nestjs/common';
import { PlatformAlertSeverity, PlatformAlertStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PlatformAlertEntity, toPlatformAlertEntity } from './entities/platform-alert.entity';

export interface CreatePlatformAlertData {
  severity: PlatformAlertSeverity;
  category: string;
  title: string;
  description?: string;
  sourceMetadata?: Record<string, unknown>;
  organizationId?: string;
}

export interface ListPlatformAlertsFilter {
  status?: PlatformAlertStatus;
  severity?: PlatformAlertSeverity;
  category?: string;
  organizationId?: string;
}

@Injectable()
export class PlatformAlertRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePlatformAlertData): Promise<PlatformAlertEntity> {
    const record = await this.prisma.system.platformAlert.create({
      data: {
        severity: data.severity,
        category: data.category,
        title: data.title,
        description: data.description,
        sourceMetadata: (data.sourceMetadata ?? {}) as Prisma.InputJsonValue,
        organizationId: data.organizationId,
      },
    });
    return toPlatformAlertEntity(record);
  }

  async findMany(filter: ListPlatformAlertsFilter): Promise<PlatformAlertEntity[]> {
    const records = await this.prisma.system.platformAlert.findMany({
      where: {
        status: filter.status,
        severity: filter.severity,
        category: filter.category,
        organizationId: filter.organizationId,
      },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toPlatformAlertEntity);
  }

  async findById(id: string): Promise<PlatformAlertEntity | null> {
    const record = await this.prisma.system.platformAlert.findUnique({ where: { id } });
    return record ? toPlatformAlertEntity(record) : null;
  }

  async acknowledge(id: string, acknowledgedById: string): Promise<PlatformAlertEntity> {
    const record = await this.prisma.system.platformAlert.update({
      where: { id },
      data: {
        status: PlatformAlertStatus.ACKNOWLEDGED,
        acknowledgedById,
        acknowledgedAt: new Date(),
      },
    });
    return toPlatformAlertEntity(record);
  }

  async resolve(id: string, resolvedById: string): Promise<PlatformAlertEntity> {
    const record = await this.prisma.system.platformAlert.update({
      where: { id },
      data: {
        status: PlatformAlertStatus.RESOLVED,
        resolvedById,
        resolvedAt: new Date(),
      },
    });
    return toPlatformAlertEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.system.platformAlert.delete({ where: { id } });
  }
}
