import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { WebhookStepDefinition } from '../definition/workflow-definition.types';
import { normalizeStepUrl, parseHttpResponseBody } from './http-request.util';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * Fires a fixed JSON payload at a fixed URL — a WEBHOOK step is
 * deliberately narrower than an API step (POST only, one fixed payload
 * shape) since its purpose is "notify this external system," not general
 * HTTP integration.
 */
@Injectable()
export class WebhookStepExecutor implements StepExecutor {
  readonly type = 'WEBHOOK' as const;

  async execute(
    step: WebhookStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const url = normalizeStepUrl(step.config.url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(step.config.headers ?? {}) },
        body: JSON.stringify(step.config.payload),
        signal: context.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `Webhook step "${step.id}" request to ${url} failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    const body = await parseHttpResponseBody(response);

    if (!response.ok) {
      throw new Error(`Webhook step "${step.id}" received status ${response.status} from ${url}`);
    }

    return { output: { status: response.status, body } };
  }
}
