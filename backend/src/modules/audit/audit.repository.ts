import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';

export interface CreateAuditLogData {
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAuditLogData): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();

    await this.prisma.auditLog.create({
      data: {
        organizationId: tenant.organizationId,
        userId: tenant.userId,
        requestId: tenant.requestId,
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
