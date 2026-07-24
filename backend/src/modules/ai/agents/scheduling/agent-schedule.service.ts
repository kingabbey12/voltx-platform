import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CronJob } from 'cron';
import { AuditService } from '../../../audit/audit.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { AgentRepository } from '../agent.repository';
import { AgentScheduleEntity, AgentScheduleTriggerType } from './agent-schedule.entity';
import { AgentScheduleRepository } from './agent-schedule.repository';
import { AgentSchedulerService } from './agent-scheduler.service';

export interface CreateAgentScheduleRequest {
  agentId: string;
  triggerType: AgentScheduleTriggerType;
  cronExpression?: string;
  eventName?: string;
  input?: Record<string, unknown>;
}

/**
 * Owns AgentSchedule CRUD; delegates live cron registration/teardown to
 * AgentSchedulerService so creating or disabling a schedule takes effect
 * immediately — mirrors WorkflowScheduleService exactly.
 */
@Injectable()
export class AgentScheduleService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly agentScheduleRepository: AgentScheduleRepository,
    private readonly agentSchedulerService: AgentSchedulerService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async createSchedule(request: CreateAgentScheduleRequest): Promise<AgentScheduleEntity> {
    const agent = await this.agentRepository.findAgentById(request.agentId);
    if (!agent) {
      throw new NotFoundException(`Agent with id "${request.agentId}" not found`);
    }

    if (request.triggerType === 'CRON') {
      if (!request.cronExpression) {
        throw new BadRequestException('CRON schedules require a cronExpression');
      }
      assertValidCronExpression(request.cronExpression);
    } else if (request.triggerType === 'EVENT' && !request.eventName) {
      throw new BadRequestException('EVENT schedules require an eventName');
    }

    const tenant = this.tenantContextService.getOrThrow();
    const schedule = await this.agentScheduleRepository.create({
      agentId: request.agentId,
      triggerType: request.triggerType,
      cronExpression: request.cronExpression,
      eventName: request.eventName,
      input: request.input,
      createdByUserId: tenant.userId ?? null,
    });

    if (schedule.triggerType === 'CRON') {
      this.agentSchedulerService.registerCronSchedule(schedule);
    }

    await this.auditService.record({
      action: 'schedule',
      resource: 'ai_agent',
      resourceId: request.agentId,
      metadata: { scheduleId: schedule.id, triggerType: schedule.triggerType },
    });

    return schedule;
  }

  async listSchedules(agentId: string): Promise<AgentScheduleEntity[]> {
    return this.agentScheduleRepository.listByAgent(agentId);
  }

  async setEnabled(scheduleId: string, enabled: boolean): Promise<AgentScheduleEntity> {
    const schedule = await this.agentScheduleRepository.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundException(`Schedule with id "${scheduleId}" not found`);
    }

    const updated = await this.agentScheduleRepository.setEnabled(scheduleId, enabled);

    if (updated.triggerType === 'CRON') {
      if (enabled) {
        this.agentSchedulerService.registerCronSchedule(updated);
      } else {
        this.agentSchedulerService.unregisterCronSchedule(scheduleId);
      }
    }

    await this.auditService.record({
      action: 'schedule',
      resource: 'ai_agent',
      resourceId: schedule.agentId,
      metadata: { scheduleId, enabled },
    });

    return updated;
  }
}

function assertValidCronExpression(expression: string): void {
  try {
    new CronJob(expression, () => undefined);
  } catch {
    throw new BadRequestException(`Invalid cron expression: "${expression}"`);
  }
}
