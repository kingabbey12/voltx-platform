import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ApiStepDefinition } from '../definition/workflow-definition.types';
import { normalizeStepUrl, parseHttpResponseBody } from './http-request.util';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * Direct HTTP integration step — distinct from a TOOL step configured
 * with http_get/http_post: this is a first-class workflow primitive (any
 * method, headers, body) independent of what's registered in the Tool
 * Framework, for calling arbitrary internal/external APIs as part of a
 * business process rather than as something an agent decided to do.
 */
@Injectable()
export class ApiStepExecutor implements StepExecutor {
  readonly type = 'API' as const;

  async execute(
    step: ApiStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const url = normalizeStepUrl(step.config.url);

    let response: Response;
    try {
      response = await fetch(url, {
        method: step.config.method,
        headers: {
          ...(step.config.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
          ...(step.config.headers ?? {}),
        },
        body: step.config.body !== undefined ? JSON.stringify(step.config.body) : undefined,
        signal: context.signal,
      });
    } catch (error) {
      throw new ServiceUnavailableException(
        `API step "${step.id}" request to ${url} failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    const body = await parseHttpResponseBody(response);

    if (!response.ok) {
      throw new Error(`API step "${step.id}" received status ${response.status} from ${url}`);
    }

    return { output: { status: response.status, body } };
  }
}
