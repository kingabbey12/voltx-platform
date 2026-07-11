import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, QueueEvents } from 'bullmq';
import { AuthContextRepository } from '../auth/auth-context.repository';
import { NotificationService } from '../notifications/notification.service';
import { AGENT_TASK_QUEUE } from '../ai/agents/jobs/agent-task-queue.constants';
import { ATTACHMENT_PROCESS_QUEUE } from '../attachments/processing/attachment-processing.constants';
import { AI_PROCESS_QUEUE } from '../communications/jobs/communications-jobs.constants';
import { BackgroundJobFailureRepository } from './background-job-failure.repository';

const MONITORED_QUEUES = [AGENT_TASK_QUEUE, ATTACHMENT_PROCESS_QUEUE, AI_PROCESS_QUEUE];

/**
 * Subscribes to every BullMQ queue's `failed` event and persists a
 * BackgroundJobFailure row once a job has exhausted its configured retry
 * attempts (QueueEvents fires `failed` on every attempt, not just the
 * last one, so this checks attemptsMade against the job's own `attempts`
 * option before treating it as a genuine dead letter). Only active when
 * REDIS_ENABLED=true — with no queue backing jobs there is nothing to
 * subscribe to; each queue's producer already runs synchronously inline
 * in that mode and surfaces failures via its own logger.
 */
@Injectable()
export class DeadLetterListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeadLetterListenerService.name);
  private readonly queues = new Map<string, Queue>();
  private readonly queueEvents: QueueEvents[] = [];

  constructor(
    private readonly configService: ConfigService,
    private readonly repository: BackgroundJobFailureRepository,
    private readonly authContextRepository: AuthContextRepository,
    private readonly notificationService: NotificationService,
  ) {}

  onModuleInit(): void {
    if (!this.configService.get<boolean>('redis.enabled', false)) {
      return;
    }

    const connection = {
      url: this.configService.get<string>('redis.url', 'redis://localhost:6379'),
    };

    for (const queueName of MONITORED_QUEUES) {
      const queue = new Queue(queueName, { connection });
      const events = new QueueEvents(queueName, { connection });
      this.queues.set(queueName, queue);
      this.queueEvents.push(events);

      events.on('failed', ({ jobId, failedReason }) => {
        this.handleFailed(queueName, jobId, failedReason).catch((error: unknown) => {
          this.logger.error({ err: error, queueName, jobId }, 'Failed to record dead letter');
        });
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.queueEvents.map((events) => events.close()));
    await Promise.all([...this.queues.values()].map((queue) => queue.close()));
  }

  private async handleFailed(
    queueName: string,
    jobId: string,
    failedReason: string,
  ): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) return;

    const job = await queue.getJob(jobId);
    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;
    if (job.attemptsMade < maxAttempts) {
      // Will retry again — only the final, exhausted failure is a dead letter.
      return;
    }

    const data = (job.data ?? {}) as Record<string, unknown>;
    const organizationId = typeof data.organizationId === 'string' ? data.organizationId : null;

    await this.repository.create({
      organizationId,
      queueName,
      jobName: job.name,
      jobId: job.id ?? null,
      payload: data,
      failureReason: failedReason,
      attemptsMade: job.attemptsMade,
    });

    if (organizationId) {
      await this.notifyOrgAdmins(organizationId, queueName, job.name, failedReason);
    }
  }

  /** Best-effort — must never throw back into the queue-events handler. */
  private async notifyOrgAdmins(
    organizationId: string,
    queueName: string,
    jobName: string,
    failedReason: string,
  ): Promise<void> {
    try {
      const recipientUserIds = await this.authContextRepository.listActiveUserIdsWithPermission(
        organizationId,
        'ops.dead_letter.read',
      );

      await Promise.all(
        recipientUserIds.map((userId) =>
          this.notificationService.create({
            organizationId,
            userId,
            category: 'WORKFLOW',
            title: `Background job failed: ${jobName}`,
            body: `A ${queueName} job exhausted its retry attempts: ${failedReason}`,
            metadata: { queueName, jobName },
          }),
        ),
      );
    } catch (error) {
      this.logger.warn(
        { err: error, organizationId, queueName },
        'Failed to notify org admins of dead letter',
      );
    }
  }
}
