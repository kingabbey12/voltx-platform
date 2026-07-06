import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowDeadLetterEntity } from './entities/workflow-support.entity';

export interface CreateWorkflowDeadLetterData {
  workflowRunId: string;
  stepId: string;
  reason: string;
  payload?: Record<string, unknown>;
}

interface WorkflowDeadLetterRecord {
  id: string;
  organizationId: string;
  workflowRunId: string;
  stepId: string;
  reason: string;
  payload: Prisma.JsonValue;
  createdAt: Date;
}

interface WorkflowDeadLetterClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowDeadLetterRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowDeadLetterRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

@Injectable()
export class WorkflowDeadLetterRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowDeadLetterData): Promise<WorkflowDeadLetterEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowRunId: data.workflowRunId,
        stepId: data.stepId,
        reason: data.reason,
        payload: data.payload ?? {},
      },
    });
    return toEntity(record);
  }

  async findAll(
    page: number,
    limit: number,
  ): Promise<{ items: WorkflowDeadLetterEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { organizationId: tenant.organizationId };
    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }],
      }),
      this.client().count({ where }),
    ]);
    return { items: records.map(toEntity), total };
  }

  private client(): WorkflowDeadLetterClient {
    return (this.prisma.system as unknown as { workflowDeadLetter: WorkflowDeadLetterClient })
      .workflowDeadLetter;
  }
}

function toEntity(record: WorkflowDeadLetterRecord): WorkflowDeadLetterEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workflowRunId: record.workflowRunId,
    stepId: record.stepId,
    reason: record.reason,
    payload: toObject(record.payload),
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
