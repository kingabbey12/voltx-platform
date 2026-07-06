import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowDefinition } from './definition/workflow-definition.types';
import { WorkflowVersionEntity } from './entities/workflow-version.entity';

export interface CreateWorkflowVersionData {
  workflowId: string;
  version: number;
  definition: WorkflowDefinition;
  createdBy: string;
}

interface WorkflowVersionRecord {
  id: string;
  organizationId: string;
  workflowId: string;
  version: number;
  definition: Prisma.JsonValue;
  createdBy: string;
  createdAt: Date;
}

interface WorkflowVersionClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowVersionRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowVersionRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowVersionRecord[]>;
}

@Injectable()
export class WorkflowVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowVersionData): Promise<WorkflowVersionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowId: data.workflowId,
        version: data.version,
        definition: data.definition,
        createdBy: data.createdBy,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<WorkflowVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findByWorkflowAndVersion(
    workflowId: string,
    version: number,
  ): Promise<WorkflowVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { workflowId, version, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findLatest(workflowId: string): Promise<WorkflowVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { workflowId, organizationId: tenant.organizationId },
      orderBy: [{ version: 'desc' }],
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async listByWorkflow(workflowId: string): Promise<WorkflowVersionEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { workflowId, organizationId: tenant.organizationId },
      orderBy: [{ version: 'asc' }],
    });
    return records.map(toEntity);
  }

  private client(): WorkflowVersionClient {
    return (this.prisma.system as unknown as { workflowVersion: WorkflowVersionClient })
      .workflowVersion;
  }
}

function toEntity(record: WorkflowVersionRecord): WorkflowVersionEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workflowId: record.workflowId,
    version: record.version,
    definition: toDefinition(record.definition),
    createdBy: record.createdBy,
    createdAt: record.createdAt,
  };
}

function toDefinition(value: Prisma.JsonValue): WorkflowDefinition {
  return value as unknown as WorkflowDefinition;
}
