import { Injectable, Logger, Optional } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  RedisConnectionService,
  redisErrorMessage,
} from '../../common/redis/redis-connection.service';
import { AuthContextRepository } from '../auth/auth-context.repository';
import { NotificationService } from '../notifications/notification.service';
import { BackgroundJobFailureRepository } from './background-job-failure.repository';

/**
 * Records terminal failures reported by the existing BullMQ Workers. Every
 * processor forwards its local `failed` event through @OnWorkerEvent, which
 * avoids one dedicated QueueEvents Redis connection per queue. This still
 * sees every job processed by this API instance and retains the existing
 * retry-exhaustion and organization-attribution behavior.
 */
@Injectable()
export class DeadLetterListenerService {
  private readonly logger = new Logger(DeadLetterListenerService.name);

  constructor(
    private readonly repository: BackgroundJobFailureRepository,
    private readonly authContextRepository: AuthContextRepository,
    private readonly notificationService: NotificationService,
    @Optional() private readonly redisConnections?: RedisConnectionService,
  ) {}

  logWorkerRedisError(queueName: string, error: Error): void {
    this.logger.error(
      {
        queueName,
        redisError: this.redisConnections?.errorMessage(error) ?? redisErrorMessage(error),
      },
      'BullMQ worker Redis connection error',
    );
  }

  async recordFailedJob<DataType extends object>(
    queueName: string,
    job: Job<DataType> | undefined,
    error: Error,
  ): Promise<void> {
    if (!job) {
      return;
    }

    try {
      await this.handleFailed(queueName, job, error.message);
    } catch (recordError) {
      this.logger.error(
        { err: recordError, queueName, jobId: job.id },
        'Failed to record dead letter',
      );
    }
  }

  private async handleFailed<DataType extends object>(
    queueName: string,
    job: Job<DataType>,
    failedReason: string,
  ): Promise<void> {
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

  /** Best-effort — must never throw back into the worker event handler. */
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
