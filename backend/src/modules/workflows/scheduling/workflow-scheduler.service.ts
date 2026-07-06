import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Interval, SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { randomUUID } from 'node:crypto';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { WorkflowScheduleEntity } from '../entities/workflow-support.entity';
import { WorkflowRepository } from '../workflow.repository';
import { WorkflowScheduleRepository } from '../workflow-schedule.repository';
import { WorkflowService } from '../workflow.service';
import { WorkflowEventBusService } from './workflow-event-bus.service';

const DELAYED_POLL_INTERVAL_MS = 30_000;

/**
 * The runtime side of Scheduling: registers a live cron job per enabled
 * CRON WorkflowSchedule (via @nestjs/schedule's SchedulerRegistry), polls
 * for due DELAYED schedules, and listens on WorkflowEventBusService for
 * EVENT-triggered ones. Every fired schedule bootstraps a tenant context
 * itself (there's no HTTP request to inherit one from) using the
 * workflow's owner (createdBy) as the "run as" identity, then delegates
 * to WorkflowService.runWorkflow — the exact same entry point the admin
 * API's "Run Workflow" endpoint uses, so a scheduled run and a manually
 * triggered one are indistinguishable once they start.
 */
@Injectable()
export class WorkflowSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowSchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly workflowScheduleRepository: WorkflowScheduleRepository,
    private readonly workflowRepository: WorkflowRepository,
    private readonly workflowService: WorkflowService,
    private readonly workflowEventBusService: WorkflowEventBusService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async onModuleInit(): Promise<void> {
    const cronSchedules = await this.workflowScheduleRepository.listEnabledByType('CRON');
    for (const schedule of cronSchedules) {
      this.registerCronSchedule(schedule);
    }

    this.workflowEventBusService.onEvent((eventName, payload) => {
      void this.handleEvent(eventName, payload);
    });
  }

  @Interval(DELAYED_POLL_INTERVAL_MS)
  async pollDueDelayedSchedules(): Promise<void> {
    const due = await this.workflowScheduleRepository.listDue(new Date());
    for (const schedule of due.filter((item) => item.triggerType === 'DELAYED')) {
      await this.workflowScheduleRepository.setEnabled(schedule.id, false);
      await this.fireSchedule(schedule, {});
    }
  }

  registerCronSchedule(schedule: WorkflowScheduleEntity): void {
    const jobName = cronJobName(schedule.id);
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }
    if (!schedule.enabled || !schedule.cronExpression) {
      return;
    }

    const job = new CronJob(schedule.cronExpression, () => {
      void this.fireSchedule(schedule, {});
    });
    this.schedulerRegistry.addCronJob(jobName, job);
    job.start();
  }

  unregisterCronSchedule(scheduleId: string): void {
    const jobName = cronJobName(scheduleId);
    if (this.schedulerRegistry.doesExist('cron', jobName)) {
      this.schedulerRegistry.deleteCronJob(jobName);
    }
  }

  private async handleEvent(eventName: string, payload: Record<string, unknown>): Promise<void> {
    const schedules = await this.workflowScheduleRepository.listEnabledByType('EVENT');
    for (const schedule of schedules.filter((item) => item.eventName === eventName)) {
      await this.fireSchedule(schedule, payload);
    }
  }

  private async fireSchedule(
    schedule: WorkflowScheduleEntity,
    extraInput: Record<string, unknown>,
  ): Promise<void> {
    try {
      const workflow = await this.workflowRepository.findByIdUnscoped(schedule.workflowId);
      if (!workflow || workflow.status !== 'PUBLISHED') {
        return;
      }

      const membership = await this.authContextRepository.findActiveMembershipContext(
        workflow.createdBy,
        workflow.organizationId,
      );
      if (!membership) {
        this.logger.warn(
          { workflowId: workflow.id },
          'Cannot fire workflow schedule: owner has no active membership in the workflow organization',
        );
        return;
      }

      await this.tenantContextService.run(
        {
          organizationId: workflow.organizationId,
          userId: workflow.createdBy,
          membershipId: membership.id,
          requestId: randomUUID(),
        },
        () =>
          this.workflowService.runWorkflow(workflow.id, {
            input: { ...schedule.input, ...extraInput },
            triggerType: schedule.triggerType,
          }),
      );

      await this.workflowScheduleRepository.markRun(schedule.id, new Date(), null);
    } catch (error) {
      this.logger.error(
        { err: error, scheduleId: schedule.id, workflowId: schedule.workflowId },
        'Failed to fire workflow schedule',
      );
    }
  }
}

function cronJobName(scheduleId: string): string {
  return `workflow-schedule-${scheduleId}`;
}
