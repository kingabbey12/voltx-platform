import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowCheckpointEntity } from './entities/workflow-support.entity';

export interface CreateWorkflowCheckpointData {
  workflowRunId: string;
  stepId: string;
  state: Record<string, unknown>;
}

interface WorkflowCheckpointRecord {
  id: string;
  workflowRunId: string;
  stepId: string;
  state: Prisma.JsonValue;
  createdAt: Date;
}

interface WorkflowCheckpointClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowCheckpointRecord>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowCheckpointRecord[]>;
}

/**
 * Append-only: each step completion writes a new checkpoint rather than
 * updating one row, so the full checkpoint history for a run is kept for
 * debugging/audit (the "Checkpointing" runtime requirement) even though
 * it isn't the mechanism resume itself uses — WorkflowEngineService
 * resumes by re-scanning WorkflowStepRun statuses (always consistent,
 * since that's the same data every other part of the run reads/writes),
 * not by replaying the latest checkpoint snapshot.
 */
@Injectable()
export class WorkflowCheckpointRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateWorkflowCheckpointData): Promise<WorkflowCheckpointEntity> {
    const record = await this.client().create({
      data: {
        workflowRunId: data.workflowRunId,
        stepId: data.stepId,
        state: data.state,
      },
    });
    return toEntity(record);
  }

  async findLatestForRun(workflowRunId: string): Promise<WorkflowCheckpointEntity | null> {
    const records = await this.client().findMany({
      where: { workflowRunId },
      orderBy: [{ createdAt: 'desc' }],
    });
    return records[0] ? toEntity(records[0]) : null;
  }

  async listByRun(workflowRunId: string): Promise<WorkflowCheckpointEntity[]> {
    const records = await this.client().findMany({
      where: { workflowRunId },
      orderBy: [{ createdAt: 'asc' }],
    });
    return records.map(toEntity);
  }

  private client(): WorkflowCheckpointClient {
    return (this.prisma.system as unknown as { workflowCheckpoint: WorkflowCheckpointClient })
      .workflowCheckpoint;
  }
}

function toEntity(record: WorkflowCheckpointRecord): WorkflowCheckpointEntity {
  return {
    id: record.id,
    workflowRunId: record.workflowRunId,
    stepId: record.stepId,
    state: toObject(record.state),
    createdAt: record.createdAt,
  };
}

function toObject(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}
