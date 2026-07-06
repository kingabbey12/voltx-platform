import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowRetryAttemptEntity } from './entities/workflow-support.entity';

export interface CreateWorkflowRetryAttemptData {
  stepRunId: string;
  attemptNumber: number;
  error: string;
  delayMs: number;
}

interface WorkflowRetryAttemptRecord {
  id: string;
  stepRunId: string;
  attemptNumber: number;
  error: string;
  delayMs: number;
  occurredAt: Date;
}

interface WorkflowRetryAttemptClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowRetryAttemptRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowRetryAttemptRecord[]>;
  count(args: { where: Record<string, unknown> }): Promise<number>;
}

@Injectable()
export class WorkflowRetryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWorkflowRetryAttemptData): Promise<WorkflowRetryAttemptEntity> {
    return this.client().create({ data: { ...data } });
  }

  async listByStepRun(stepRunId: string): Promise<WorkflowRetryAttemptEntity[]> {
    return this.client().findMany({ where: { stepRunId }, orderBy: [{ attemptNumber: 'asc' }] });
  }

  async countForRun(stepRunIds: string[]): Promise<number> {
    if (stepRunIds.length === 0) {
      return 0;
    }
    return this.client().count({ where: { stepRunId: { in: stepRunIds } } });
  }

  /** Joins through workflow_step_runs since retry attempts aren't linked to a workflow directly. */
  async countByWorkflow(workflowId: string): Promise<number> {
    const rows = await this.prisma.system.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*)::bigint AS count
      FROM workflow_retry_attempts ra
      INNER JOIN workflow_step_runs sr ON sr.id = ra.step_run_id
      INNER JOIN workflow_runs r ON r.id = sr.workflow_run_id
      WHERE r.workflow_id = ${workflowId}::uuid
    `;
    return Number(rows[0]?.count ?? 0);
  }

  private client(): WorkflowRetryAttemptClient {
    return (this.prisma.system as unknown as { workflowRetryAttempt: WorkflowRetryAttemptClient })
      .workflowRetryAttempt;
  }
}
