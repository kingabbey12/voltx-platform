import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { IntegrationHealthStatus } from './entities/integration-connection.entity';
import { IntegrationHealthCheckEntity } from './entities/integration-support.entity';

export interface CreateIntegrationHealthCheckData {
  organizationId: string;
  connectionId: string;
  status: IntegrationHealthStatus;
  latencyMs?: number;
  message?: string;
}

interface IntegrationHealthCheckClient {
  create(args: { data: Record<string, unknown> }): Promise<IntegrationHealthCheckEntity>;
  findMany(args: {
    where: Record<string, unknown>;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<IntegrationHealthCheckEntity[]>;
}

@Injectable()
export class IntegrationHealthCheckRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateIntegrationHealthCheckData): Promise<IntegrationHealthCheckEntity> {
    return this.client().create({ data: { ...data } });
  }

  async listByConnection(
    connectionId: string,
    limit = 50,
  ): Promise<IntegrationHealthCheckEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findMany({
      where: { connectionId, organizationId: tenant.organizationId },
      take: limit,
      orderBy: { checkedAt: 'desc' },
    });
  }

  private client(): IntegrationHealthCheckClient {
    return (
      this.prisma.system as unknown as { integrationHealthCheck: IntegrationHealthCheckClient }
    ).integrationHealthCheck;
  }
}
