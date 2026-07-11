import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowStepType } from './definition/workflow-definition.types';
import { WorkflowStepRunEntity, WorkflowStepRunStatus } from './entities/workflow-step-run.entity';

export interface CreateWorkflowStepRunData {
  workflowRunId: string;
  stepId: string;
  type: WorkflowStepType;
  input?: Record<string, unknown>;
}

export interface UpdateWorkflowStepRunData {
  status?: WorkflowStepRunStatus;
  output?: Record<string, unknown>;
  attempt?: number;
  error?: string | null;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

interface WorkflowStepRunRecord {
  id: string;
  organizationId: string;
  workflowRunId: string;
  stepId: string;
  type: WorkflowStepType;
  status: WorkflowStepRunStatus;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue;
  attempt: number;
  error: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

interface WorkflowStepRunClient {
  upsert(args: {
    where: { workflowRunId_stepId: { workflowRunId: string; stepId: string } };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }): Promise<WorkflowStepRunRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowStepRunRecord | null>;
  updateMany(args: {
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }): Promise<{ count: number }>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowStepRunRecord[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowStepRunRecord>;
}

/**
 * One row per (workflowRunId, stepId) — upsert() is the primary write
 * path since a step may be re-entered across retries/resumes and must
 * always land on the same row (the unique constraint on
 * (workflow_run_id, step_id) is what makes idempotent step tracking
 * possible).
 */
@Injectable()
export class WorkflowStepRunRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async upsertPending(data: CreateWorkflowStepRunData): Promise<WorkflowStepRunEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().upsert({
      where: { workflowRunId_stepId: { workflowRunId: data.workflowRunId, stepId: data.stepId } },
      create: {
        organizationId: tenant.organizationId,
        workflowRunId: data.workflowRunId,
        stepId: data.stepId,
        type: data.type,
        input: toJsonValue(data.input) ?? {},
        status: 'PENDING',
      },
      update: {
        input: toJsonValue(data.input) ?? {},
      },
    });
    return toEntity(record);
  }

  async findById(id: string): Promise<WorkflowStepRunEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async findByRunAndStep(
    workflowRunId: string,
    stepId: string,
  ): Promise<WorkflowStepRunEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.client().findFirst({
      where: { workflowRunId, stepId, organizationId: tenant.organizationId },
    });
    return record ? toEntity(record) : null;
  }

  async listByRun(workflowRunId: string): Promise<WorkflowStepRunEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { workflowRunId, organizationId: tenant.organizationId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return records.map(toEntity);
  }

  /**
   * "Retry Workflow": resets every FAILED step back to PENDING (fresh
   * attempt budget, cleared error) so the scheduler re-selects it as
   * ready on the next executeRun call — SUCCEEDED/SKIPPED steps are left
   * untouched, which is what makes retrying a run resume rather than
   * restart it from scratch.
   */
  async resetFailedForRetry(workflowRunId: string): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const result = await this.client().updateMany({
      where: { workflowRunId, organizationId: tenant.organizationId, status: 'FAILED' },
      data: { status: 'PENDING', attempt: 0, error: null, completedAt: null },
    });
    return result.count;
  }

  /** Joins through workflow_runs since a step run isn't linked to its workflow directly, only its run. */
  async countByWorkflowAndType(workflowId: string, type: WorkflowStepType): Promise<number> {
    const tenant = this.tenantContextService.getOrThrow();
    const rows = await this.prisma.system.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM workflow_step_runs sr
      INNER JOIN workflow_runs r ON r.id = sr.workflow_run_id
      WHERE r.workflow_id = ${workflowId}::uuid AND r.organization_id = ${tenant.organizationId}::uuid AND sr.type = ${type}::"WorkflowStepType" AND sr.status = 'SUCCEEDED'
    `;
    return Number(rows[0]?.count ?? 0);
  }

  async update(id: string, data: UpdateWorkflowStepRunData): Promise<WorkflowStepRunEntity> {
    const record = await this.client().update({
      where: { id },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.output !== undefined ? { output: toJsonValue(data.output) ?? {} } : {}),
        ...(data.attempt !== undefined ? { attempt: data.attempt } : {}),
        ...(data.error !== undefined ? { error: data.error } : {}),
        ...(data.startedAt !== undefined ? { startedAt: data.startedAt } : {}),
        ...(data.completedAt !== undefined ? { completedAt: data.completedAt } : {}),
        ...(data.durationMs !== undefined ? { durationMs: data.durationMs } : {}),
      },
    });
    return toEntity(record);
  }

  private client(): WorkflowStepRunClient {
    return (this.prisma.system as unknown as { workflowStepRun: WorkflowStepRunClient })
      .workflowStepRun;
  }
}

function toEntity(record: WorkflowStepRunRecord): WorkflowStepRunEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    workflowRunId: record.workflowRunId,
    stepId: record.stepId,
    type: record.type,
    status: record.status,
    input: toObject(record.input),
    output: toObject(record.output),
    attempt: record.attempt,
    error: record.error,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs: record.durationMs,
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
