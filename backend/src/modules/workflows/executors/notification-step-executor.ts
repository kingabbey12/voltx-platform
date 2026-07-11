import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { NotificationService } from '../../notifications/notification.service';
import { NotificationStepDefinition } from '../definition/workflow-definition.types';
import { normalizeStepUrl } from './http-request.util';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

@Injectable()
export class NotificationStepExecutor implements StepExecutor {
  readonly type = 'NOTIFICATION' as const;
  private readonly logger = new Logger(NotificationStepExecutor.name);

  constructor(private readonly notificationService: NotificationService) {}

  async execute(
    step: NotificationStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    if (step.config.channel === 'log') {
      this.logger.log(
        { workflowRunId: context.workflowRunId, metadata: step.config.metadata },
        step.config.message,
      );
      return { output: { delivered: true, channel: 'log' } };
    }

    if (step.config.channel === 'notification') {
      if (!step.config.userId) {
        throw new Error(`Notification step "${step.id}" is missing config.userId`);
      }
      const created = await this.notificationService.create({
        organizationId: context.organizationId,
        userId: step.config.userId,
        category: 'WORKFLOW',
        title: step.config.title ?? 'Workflow notification',
        body: step.config.message,
        actionUrl: `/workflows/runs/${context.workflowRunId}`,
        metadata: step.config.metadata,
      });
      return { output: { delivered: true, channel: 'notification', notificationId: created.id } };
    }

    const url = normalizeStepUrl(step.config.webhookUrl ?? '');

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: step.config.message,
          metadata: step.config.metadata ?? {},
        }),
        signal: context.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Notification step "${step.id}" failed to reach ${url}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    if (!response.ok) {
      throw new Error(
        `Notification step "${step.id}" received status ${response.status} from ${url}`,
      );
    }

    return { output: { delivered: true, channel: 'webhook', status: response.status } };
  }
}
