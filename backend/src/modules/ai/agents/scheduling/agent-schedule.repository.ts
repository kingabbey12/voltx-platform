import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import {
  AgentScheduleEntity,
  AgentScheduleTriggerType,
  toAgentScheduleEntity,
} from './agent-schedule.entity';

export interface CreateAgentScheduleData {
  agentId: string;
  agentVersionId?: string | null;
  triggerType: AgentScheduleTriggerType;
  cronExpression?: string;
  eventName?: string;
  input?: Record<string, unknown>;
  createdByUserId?: string | null;
}

/** Tenant-scoped CRUD for AgentSchedule — mirrors WorkflowScheduleRepository. */
@Injectable()
export class AgentScheduleRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get schedules() {
    return this.prisma.system.agentSchedule;
  }

  async create(data: CreateAgentScheduleData): Promise<AgentScheduleEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.schedules.create({
      data: {
        organizationId: tenant.organizationId,
        agentId: data.agentId,
        agentVersionId: data.agentVersionId ?? null,
        triggerType: data.triggerType,
        cronExpression: data.cronExpression ?? null,
        eventName: data.eventName ?? null,
        input: (data.input ?? {}) as Prisma.InputJsonValue,
        createdByUserId: data.createdByUserId ?? tenant.userId ?? null,
        enabled: true,
      },
    });
    return toAgentScheduleEntity(record);
  }

  async findById(id: string): Promise<AgentScheduleEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.schedules.findFirst({
      where: { id, organizationId: tenant.organizationId },
    });
    return record ? toAgentScheduleEntity(record) : null;
  }

  /** Bypasses tenant scoping — for the scheduler's own background context. */
  async findByIdUnscoped(id: string): Promise<AgentScheduleEntity | null> {
    const record = await this.schedules.findFirst({ where: { id } });
    return record ? toAgentScheduleEntity(record) : null;
  }

  async listEnabledByType(triggerType: AgentScheduleTriggerType): Promise<AgentScheduleEntity[]> {
    const records = await this.schedules.findMany({ where: { triggerType, enabled: true } });
    return records.map(toAgentScheduleEntity);
  }

  async listByAgent(agentId: string): Promise<AgentScheduleEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.schedules.findMany({
      where: { agentId, organizationId: tenant.organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toAgentScheduleEntity);
  }

  async setEnabled(id: string, enabled: boolean): Promise<AgentScheduleEntity> {
    const record = await this.schedules.update({ where: { id }, data: { enabled } });
    return toAgentScheduleEntity(record);
  }

  async markRun(id: string, lastRunAt: Date): Promise<AgentScheduleEntity> {
    const record = await this.schedules.update({ where: { id }, data: { lastRunAt } });
    return toAgentScheduleEntity(record);
  }
}
