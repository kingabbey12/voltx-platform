import type { ToolGrounding } from './tool-result.types';

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
  /**
   * Fallback RBAC requirement consulted by AiToolPermissionService only
   * when this tool has no explicit entry in its central
   * TOOL_PERMISSION_REQUIREMENTS map — for dynamically-generated tools
   * (e.g. one per integration connector action) whose permission can't be
   * centrally hand-maintained. Hand-written tools should keep declaring
   * their requirement in that central map instead; leave this unset there.
   */
  readonly requiredPermission?: string | null;

  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;

  /**
   * Optional grounding hook (Ask pipeline): given the input and the output
   * of a successful execution, return the owner-facing summary, the
   * canonical records the result rests on, and the events the execution
   * caused — or null when nothing meaningful can be claimed. Must be pure
   * over its arguments (no I/O): it runs after execute() on the same data.
   */
  ground?(input: TInput, output: TOutput): ToolGrounding | null;
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
