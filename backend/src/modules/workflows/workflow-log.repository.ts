import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { WorkflowExecutionLogEntity, WorkflowLogLevel } from './entities/workflow-support.entity';

export interface CreateWorkflowLogData {
  workflowRunId: string;
  stepRunId?: string;
  level?: WorkflowLogLevel;
  event: string;
  message: string;
  metadata?: Record<string, unknown>;
}

interface WorkflowLogRecord {
  id: string;
  workflowRunId: string;
  stepRunId: string | null;
  level: WorkflowLogLevel;
  event: string;
  message: string;
  metadata: Prisma.JsonValue;
  createdAt: Date;
}

interface WorkflowLogClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowLogRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowLogRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

/**
 * Never throws: logging a lifecycle event must never fail the run whose
 * lifecycle it's recording, matching AiUsageService/KnowledgeSearchLogRepository's
 * telemetry convention.
 */
@Injectable()
export class WorkflowLogRepository {
  private readonly logger = new Logger(WorkflowLogRepository.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowLogData): Promise<void> {
    try {
      await this.client().create({
        data: {
          workflowRunId: data.workflowRunId,
          stepRunId: data.stepRunId ?? null,
          level: data.level ?? 'INFO',
          event: data.event,
          message: data.message,
          metadata: data.metadata ?? {},
        },
      });
    } catch (error) {
      this.logger.error({ err: error, event: data.event }, 'Failed to persist workflow log');
    }
  }

  async listByRun(
    workflowRunId: string,
    page: number,
    limit: number,
  ): Promise<{ items: WorkflowExecutionLogEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where = { workflowRunId, workflowRun: { organizationId: tenant.organizationId } };
    const [records, total] = await Promise.all([
      this.client().findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'asc' }],
      }),
      this.client().count({ where }),
    ]);
    return { items: records.map(toEntity), total };
  }

  private client(): WorkflowLogClient {
    return (this.prisma.system as unknown as { workflowExecutionLog: WorkflowLogClient })
      .workflowExecutionLog;
  }
}

function toEntity(record: WorkflowLogRecord): WorkflowExecutionLogEntity {
  return {
    id: record.id,
    workflowRunId: record.workflowRunId,
    stepRunId: record.stepRunId,
    level: record.level,
    event: record.event,
    message: record.message,
    metadata: toObject(record.metadata),
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
