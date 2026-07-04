export interface ToolParameterSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface ToolSchema {
  type: 'object';
  properties: Record<string, ToolParameterSchema>;
}

export interface ToolExecutionContext {
  conversationId: string;
  signal: AbortSignal;
}

export interface AITool<
  TInput extends Record<string, unknown> = Record<string, unknown>,
  TOutput = unknown,
> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;
  readonly defaultTimeoutMs?: number;
  readonly defaultRetries?: number;

  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
}

export class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = 'ToolExecutionError';
  }
}

export const AI_TOOLS = Symbol('AI_TOOLS');
