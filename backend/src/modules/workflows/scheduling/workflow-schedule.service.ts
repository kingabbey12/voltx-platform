import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CronJob } from 'cron';
import { WorkflowScheduleEntity } from '../entities/workflow-support.entity';
import { WorkflowTriggerType } from '../entities/workflow-run.entity';
import { WorkflowRepository } from '../workflow.repository';
import { WorkflowScheduleRepository } from '../workflow-schedule.repository';
import { WorkflowSchedulerService } from './workflow-scheduler.service';

export interface CreateScheduleRequest {
  workflowId: string;
  triggerType: Extract<WorkflowTriggerType, 'CRON' | 'DELAYED' | 'EVENT'>;
  cronExpression?: string;
  delayMs?: number;
  eventName?: string;
  input?: Record<string, unknown>;
}

/**
 * Owns WorkflowSchedule CRUD; delegates the actual live cron
 * registration/teardown to WorkflowSchedulerService so creating or
 * disabling a schedule takes effect immediately, without a process
 * restart.
 */
@Injectable()
export class WorkflowScheduleService {
  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly workflowScheduleRepository: WorkflowScheduleRepository,
    private readonly workflowSchedulerService: WorkflowSchedulerService,
  ) {}

  async createSchedule(request: CreateScheduleRequest): Promise<WorkflowScheduleEntity> {
    const workflow = await this.workflowRepository.findById(request.workflowId);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id "${request.workflowId}" not found`);
    }

    let nextRunAt: Date | undefined;
    if (request.triggerType === 'CRON') {
      if (!request.cronExpression) {
        throw new BadRequestException('CRON schedules require a cronExpression');
      }
      assertValidCronExpression(request.cronExpression);
    } else if (request.triggerType === 'DELAYED') {
      if (!request.delayMs || request.delayMs <= 0) {
        throw new BadRequestException('DELAYED schedules require a positive delayMs');
      }
      nextRunAt = new Date(Date.now() + request.delayMs);
    } else if (request.triggerType === 'EVENT' && !request.eventName) {
      throw new BadRequestException('EVENT schedules require an eventName');
    }

    const schedule = await this.workflowScheduleRepository.create({
      workflowId: request.workflowId,
      triggerType: request.triggerType,
      cronExpression: request.cronExpression,
      delayMs: request.delayMs,
      eventName: request.eventName,
      input: request.input,
      nextRunAt,
    });

    if (schedule.triggerType === 'CRON') {
      this.workflowSchedulerService.registerCronSchedule(schedule);
    }

    return schedule;
  }

  async listSchedules(workflowId: string): Promise<WorkflowScheduleEntity[]> {
    return this.workflowScheduleRepository.listByWorkflow(workflowId);
  }

  async setEnabled(scheduleId: string, enabled: boolean): Promise<WorkflowScheduleEntity> {
    const schedule = await this.workflowScheduleRepository.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundException(`Schedule with id "${scheduleId}" not found`);
    }

    const updated = await this.workflowScheduleRepository.setEnabled(scheduleId, enabled);

    if (updated.triggerType === 'CRON') {
      if (enabled) {
        this.workflowSchedulerService.registerCronSchedule(updated);
      } else {
        this.workflowSchedulerService.unregisterCronSchedule(scheduleId);
      }
    }

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
