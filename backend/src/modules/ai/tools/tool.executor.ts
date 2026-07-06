import { Injectable, Logger } from '@nestjs/common';
import { ToolRegistry } from './tool.registry';
import { ToolExecutionError } from './tool.interface';

export interface ExecuteToolInput {
  toolName: string;
  input: Record<string, unknown>;
  conversationId: string;
  timeoutMs?: number;
  retries?: number;
  signal?: AbortSignal;
}

export interface ExecuteToolResult {
  output: unknown;
  durationMs: number;
  attempts: number;
}

@Injectable()
export class ToolExecutor {
  private readonly logger = new Logger(ToolExecutor.name);

  constructor(private readonly toolRegistry: ToolRegistry) {}

  async execute(input: ExecuteToolInput): Promise<ExecuteToolResult> {
    const tool = this.toolRegistry.get(input.toolName);
    const retries = input.retries ?? tool.defaultRetries ?? 0;
    const timeoutMs = input.timeoutMs ?? tool.defaultTimeoutMs ?? 5000;

    let attempt = 0;

    while (true) {
      const startedAt = Date.now();
      const controller = new AbortController();
      let timedOut = false;
      const timeout = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, timeoutMs);

      const onExternalAbort = () => controller.abort();
      input.signal?.addEventListener('abort', onExternalAbort);

      try {
        const output = await tool.execute(input.input, {
          conversationId: input.conversationId,
          signal: controller.signal,
        });

        clearTimeout(timeout);

        const durationMs = Date.now() - startedAt;
        this.logger.log(
          {
            toolName: tool.name,
            conversationId: input.conversationId,
            durationMs,
            attempt: attempt + 1,
          },
          'AI tool execution completed',
        );

        return {
          output,
          durationMs,
          attempts: attempt + 1,
        };
      } catch (error) {
        clearTimeout(timeout);

        if (input.signal?.aborted) {
          throw new ToolExecutionError(
            `Tool "${tool.name}" was cancelled`,
            'tool_cancelled',
            false,
          );
        }

        if (timedOut) {
          throw new ToolExecutionError(
            `Tool "${tool.name}" timed out after ${timeoutMs}ms`,
            'tool_timeout',
            false,
          );
        }

        if (error instanceof ToolExecutionError && error.retryable && attempt < retries) {
          attempt += 1;
          continue;
        }

        if (error instanceof ToolExecutionError) {
          throw error;
        }

        throw new ToolExecutionError(
          error instanceof Error ? error.message : 'Tool execution failed',
          'tool_execution_failed',
        );
      } finally {
        input.signal?.removeEventListener('abort', onExternalAbort);
      }
    }
  }
}
