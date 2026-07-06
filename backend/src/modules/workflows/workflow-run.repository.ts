import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  WorkflowRunEntity,
  WorkflowRunStatus,
  WorkflowTriggerType,
} from './entities/workflow-run.entity';

export interface CreateWorkflowRunData {
  workflowId: string;
  workflowVersionId: string;
  conversationId: string;
  triggerType: WorkflowTriggerType;
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  triggeredBy?: string;
}

export interface UpdateWorkflowRunData {
  status?: WorkflowRunStatus;
  context?: Record<string, unknown>;
  output?: Record<string, unknown>;
  currentStepId?: string | null;
  error?: string | null;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

export interface FindWorkflowRunsParams {
  page: number;
  limit: number;
  workflowId?: string;
  status?: WorkflowRunStatus;
}

export interface PaginatedWorkflowRuns {
  items: WorkflowRunEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface WorkflowRunAggregate {
  totalRuns: number;
  succeededRuns: number;
  failedRuns: number;
  cancelledRuns: number;
  averageDurationMs: number;
  averageQueueMs: number;
}

interface WorkflowRunRecord {
  id: string;
  organizationId: string;
  workflowId: string;
  workflowVersionId: string;
  conversationId: string;
  status: WorkflowRunStatus;
  triggerType: WorkflowTriggerType;
  input: Prisma.JsonValue;
  context: Prisma.JsonValue;
  output: Prisma.JsonValue;
  currentStepId: string | null;
  idempotencyKey: string | null;
  triggeredBy: string | null;
  error: string | null;
  version: number;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  queuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowRunClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowRunRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowRunRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    skip?: number;
    take?: number;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowRunRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowRunRecord>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
}

/**
 * WorkflowRun.version is an optimistic-concurrency counter: every state
 * transition (status change, checkpoint, pause/resume/cancel) goes through
 * updateWithVersion, which does a conditional `WHERE id = ? AND version =
 * ?` update and throws if zero rows matched — meaning something else
 * already moved this run's state since it was read. Plain update() is for
 * callers that already hold an exclusive path (e.g. the row was just
 * created) and don't need the check.
 */
@Injectable()
export class WorkflowRunRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowRunData): Promise<WorkflowRunEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowId: data.workflowId,
        workflowVersionId: data.workflowVersionId,
        conversationId: data.conversationId,
        triggerType: data.triggerType,
        input: toJsonValue(data.input) ?? {},
        context: {},
        output: {},
        idempotencyKey: data.idempotencyKey ?? null,
        triggeredBy: data.triggeredBy ?? null,
        status: 'PENDING',
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<WorkflowRunEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findByIdempotencyKey(
    workflowId: string,
    idempotencyKey: string,
  ): Promise<WorkflowRunEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { workflowId, idempotencyKey, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findAll(params: FindWorkflowRunsParams): Promise<PaginatedWorkflowRuns> {
    const tenant = this.tenantContextService.getOrThrow();
    const skip = (params.page - 1) * params.limit;
    const where = {
      organizationId: tenant.organizationId,
      ...(params.workflowId ? { workflowId: params.workflowId } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [records, total] = await Promise.all([
      this.client().findMany({ where, skip, take: params.limit, orderBy: [{ createdAt: 'desc' }] }),
      this.client().count({ where }),
    ]);

    return {
      items: records.map(toEntity),
      total,
      page: params.page,
      limit: params.limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / params.limit),
    };
  }

  /** No concurrency check — only safe immediately after create() while nothing else can see the row. */
  async update(id: string, data: UpdateWorkflowRunData): Promise<WorkflowRunEntity> {
    const record = await this.client().update({ where: { id }, data: toUpdateData(data) });
    return toEntity(record);
  }

  /**
   * Throws ConflictException if `expectedVersion` no longer matches —
   * the caller read a run, another writer already advanced it, and this
   * write must not blindly overwrite that newer state.
   */
  async updateWithVersion(
    id: string,
    expectedVersion: number,
    data: UpdateWorkflowRunData,
  ): Promise<WorkflowRunEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const result = await this.client().updateMany({
      where: { id, version: expectedVersion, organizationId: tenant.organizationId },
      data: { ...toUpdateData(data), version: { increment: 1 } },
    });

    if (result.count === 0) {
      throw new ConflictException(
        `Workflow run "${id}" was modified concurrently (expected version ${expectedVersion})`,
      );
    }

    const updated = await this.findById(id);
    if (!updated) {
      throw new ConflictException(`Workflow run "${id}" not found after update`);
    }
    return updated;
  }

  async aggregateForWorkflow(workflowId: string): Promise<WorkflowRunAggregate> {
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.prisma.system.$queryRaw<
      Array<{
        total_runs: bigint;
        succeeded_runs: bigint;
        failed_runs: bigint;
        cancelled_runs: bigint;
        avg_duration_ms: number | null;
        avg_queue_ms: number | null;
      }>
    >`
      SELECT
        COUNT(*)::bigint AS total_runs,
        COUNT(*) FILTER (WHERE status = 'SUCCEEDED')::bigint AS succeeded_runs,
        COUNT(*) FILTER (WHERE status = 'FAILED')::bigint AS failed_runs,
        COUNT(*) FILTER (WHERE status = 'CANCELLED')::bigint AS cancelled_runs,
        AVG(duration_ms) AS avg_duration_ms,
        AVG(EXTRACT(EPOCH FROM (started_at - queued_at)) * 1000) FILTER (WHERE started_at IS NOT NULL) AS avg_queue_ms
      FROM workflow_runs
      WHERE workflow_id = ${workflowId}::uuid AND organization_id = ${tenant.organizationId}::uuid
    `;

    const row = rows[0];
    return {
      totalRuns: Number(row?.total_runs ?? 0),
      succeededRuns: Number(row?.succeeded_runs ?? 0),
      failedRuns: Number(row?.failed_runs ?? 0),
      cancelledRuns: Number(row?.cancelled_runs ?? 0),
      averageDurationMs: row?.avg_duration_ms ?? 0,
      averageQueueMs: row?.avg_queue_ms ?? 0,
    };
  }

  private client(): WorkflowRunClient {
    return (this.prisma.system as unknown as { workflowRun: WorkflowRunClient }).workflowRun;
  }
}

function toUpdateData(data: UpdateWorkflowRunData): Record<string, unknown> {
  return {
    ...(data.status !== undefined ? { status: data.status } : {}),
    ...(data.context !== undefined ? { context: toJsonValue(data.context) ?? {} } : {}),
    ...(data.output !== undefined ? { output: toJsonValue(data.output) ?? {} } : {}),
    ...(data.currentStepId !== undefined ? { currentStepId: data.currentStepId } : {}),
    ...(data.error !== undefined ? { error: data.error } : {}),
    ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
    ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
    ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
  };
}

function toEntity(record: WorkflowRunRecord): WorkflowRunEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workflowId: record.workflowId,
    workflowVersionId: record.workflowVersionId,
    conversationId: record.conversationId,
    status: record.status,
    triggerType: record.triggerType,
    input: toObject(record.input),
    context: toObject(record.context),
    output: toObject(record.output),
    currentStepId: record.currentStepId,
    idempotencyKey: record.idempotencyKey,
    triggeredBy: record.triggeredBy,
    error: record.error,
    version: record.version,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    queuedAt: record.queuedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function toJsonValue(value?: Record<string, unknown>): Prisma.InputJsonValue | undefined {
  if (!value) {
    return undefined;
  }
  return value as Prisma.InputJsonValue;
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
