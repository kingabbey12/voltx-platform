import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { AuditService } from '../../../audit/audit.service';
import { AuthContextRepository } from '../../../auth/auth-context.repository';
import { WorkflowEventBusService } from '../../../workflows/scheduling/workflow-event-bus.service';
import { AgentRepository } from '../agent.repository';
import { AgentTaskQueueService } from '../jobs/agent-task-queue.service';
import { AgentScheduleEntity } from './agent-schedule.entity';
import { AgentScheduleRepository } from './agent-schedule.repository';

/**
 * The runtime side of agent scheduling: registers a live cron job per
 * enabled CRON AgentSchedule (via @nestjs/schedule's SchedulerRegistry) and
 * listens on the platform-wide WorkflowEventBusService for EVENT-triggered
 * ones — the same generic event bus Workflow scheduling uses (it fans out
 * "eventName -> payload" regardless of which subsystem is listening, so
 * reusing it here means one event firing can trigger both a workflow and
 * an agent schedule without a second bus). Unlike WorkflowSchedulerService
 * (which calls WorkflowService.runWorkflow directly inline), firing here
 * enqueues onto the existing AGENT_TASK_QUEUE so a scheduled agent run gets
 * BullMQ's retry/backoff for free and never blocks the scheduler tick.
 */
@Injectable()
export class AgentSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(AgentSchedulerService.name);

  constructor(
    private readonly schedulerRegistry: SchedulerRegistry,
    private readonly agentScheduleRepository: AgentScheduleRepository,
    private readonly agentRepository: AgentRepository,
    private readonly agentTaskQueueService: AgentTaskQueueService,
    private readonly workflowEventBusService: WorkflowEventBusService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly auditService: AuditService,
  ) {}

  async onModuleInit(): Promise<void> {
    const cronSchedules = await this.agentScheduleRepository.listEnabledByType('CRON');
    for (const schedule of cronSchedules) {
      this.registerCronSchedule(schedule);
    }

    this.workflowEventBusService.onEvent((eventName, payload) => {
      void this.handleEvent(eventName, payload);
    });
  }

  registerCronSchedule(schedule: AgentScheduleEntity): void {
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
    const schedules = await this.agentScheduleRepository.listEnabledByType('EVENT');
    for (const schedule of schedules.filter((item) => item.eventName === eventName)) {
      await this.fireSchedule(schedule, payload);
    }
  }

  private async fireSchedule(
    schedule: AgentScheduleEntity,
    extraInput: Record<string, unknown>,
  ): Promise<void> {
    try {
      const agent = await this.agentRepository.findAgentByIdUnscoped(schedule.agentId);
      if (!agent || agent.status !== 'PUBLISHED' || !agent.enabled) {
        return;
      }

      if (!schedule.createdByUserId) {
        this.logger.warn(
          { scheduleId: schedule.id, agentId: agent.id },
          'Cannot fire agent schedule: no createdByUserId to run as',
        );
        return;
      }

      const membership = await this.authContextRepository.findActiveMembershipContext(
        schedule.createdByUserId,
        schedule.organizationId,
      );
      if (!membership) {
        this.logger.warn(
          { agentId: agent.id, scheduleId: schedule.id },
          'Cannot fire agent schedule: owner has no active membership in the agent organization',
        );
        return;
      }

      await this.auditService.recordWithExplicitActor({
        organizationId: schedule.organizationId,
        userId: schedule.createdByUserId,
        action: 'schedule_fire',
        resource: 'ai_agent',
        resourceId: agent.id,
        metadata: { scheduleId: schedule.id, triggerType: schedule.triggerType },
      });

      this.agentTaskQueueService.enqueueScheduledAgentRun(
        schedule.id,
        agent.id,
        schedule.organizationId,
        { ...schedule.input, ...extraInput },
      );

      await this.agentScheduleRepository.markRun(schedule.id, new Date());
    } catch (error) {
      this.logger.error(
        { err: error, scheduleId: schedule.id, agentId: schedule.agentId },
        'Failed to fire agent schedule',
      );
    }
  }
}

function cronJobName(scheduleId: string): string {
  return `agent-schedule-${scheduleId}`;
}
