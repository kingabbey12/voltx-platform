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
    await this.write({ ...data, organizationId: tenant.organizationId, userId: tenant.userId });
  }

  /** For the handful of legitimately unauthenticated actions worth
   * auditing (e.g. accepting an org invitation before any session exists)
   * where there is no JWT-derived tenant context to pull from. */
  async createWithExplicitActor(
    data: CreateAuditLogData & { organizationId: string; userId: string },
  ): Promise<void> {
    await this.write(data);
  }

  private async write(
    data: CreateAuditLogData & { organizationId: string; userId: string },
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        organizationId: data.organizationId,
        userId: data.userId,
        // Set unconditionally by TenantMiddleware on every request, with or
        // without a JWT — always present in practice.
        requestId: this.tenantContextService.get()?.requestId ?? 'unknown',
        action: data.action,
        resource: data.resource,
        resourceId: data.resourceId,
        metadata: (data.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }
}
