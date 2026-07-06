import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowScheduleEntity } from './entities/workflow-support.entity';

export interface CreateWorkflowScheduleData {
  workflowId: string;
  triggerType: 'CRON' | 'DELAYED' | 'EVENT';
  cronExpression?: string;
  delayMs?: number;
  eventName?: string;
  input?: Record<string, unknown>;
  nextRunAt?: Date;
}

interface WorkflowScheduleRecord {
  id: string;
  organizationId: string;
  workflowId: string;
  triggerType: 'CRON' | 'DELAYED' | 'EVENT';
  cronExpression: string | null;
  delayMs: number | null;
  eventName: string | null;
  input: Prisma.JsonValue;
  enabled: boolean;
  nextRunAt: Date | null;
  lastRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowScheduleClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowScheduleRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowScheduleRecord | null>;
  findMany(args: { where: Record<string, unknown> }): Promise<WorkflowScheduleRecord[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowScheduleRecord>;
}

@Injectable()
export class WorkflowScheduleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowScheduleData): Promise<WorkflowScheduleEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowId: data.workflowId,
        triggerType: data.triggerType,
        cronExpression: data.cronExpression ?? null,
        delayMs: data.delayMs ?? null,
        eventName: data.eventName ?? null,
        input: data.input ?? {},
        nextRunAt: data.nextRunAt ?? null,
        enabled: true,
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<WorkflowScheduleEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async listEnabledByType(
    triggerType: 'CRON' | 'DELAYED' | 'EVENT',
  ): Promise<WorkflowScheduleEntity[]> {
    const records = await this.client().findMany({ where: { triggerType, enabled: true } });
    return records.map(toEntity);
  }

  async listDue(before: Date): Promise<WorkflowScheduleEntity[]> {
    const records = await this.client().findMany({
      where: { enabled: true, nextRunAt: { lte: before } },
    });
    return records.map(toEntity);
  }

  async listByWorkflow(workflowId: string): Promise<WorkflowScheduleEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { workflowId, organizationId: tenant.organizationId },
    });
    return records.map(toEntity);
  }

  async setEnabled(id: string, enabled: boolean): Promise<WorkflowScheduleEntity> {
    const record = await this.client().update({ where: { id }, data: { enabled } });
    return toEntity(record);
  }

  async markRun(
    id: string,
    lastRunAt: Date,
    nextRunAt: Date | null,
  ): Promise<WorkflowScheduleEntity> {
    const record = await this.client().update({ where: { id }, data: { lastRunAt, nextRunAt } });
    return toEntity(record);
  }

  private client(): WorkflowScheduleClient {
    return (this.prisma.system as unknown as { workflowSchedule: WorkflowScheduleClient })
      .workflowSchedule;
  }
}

function toEntity(record: WorkflowScheduleRecord): WorkflowScheduleEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workflowId: record.workflowId,
    triggerType: record.triggerType,
    cronExpression: record.cronExpression,
    delayMs: record.delayMs,
    eventName: record.eventName,
    input: toObject(record.input),
    enabled: record.enabled,
    nextRunAt: record.nextRunAt,
    lastRunAt: record.lastRunAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
