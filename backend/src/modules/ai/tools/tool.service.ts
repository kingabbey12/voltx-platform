import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { MessageResponseDto } from '../conversations/dto/conversation.dto';
import { ToolExecutionError } from './tool.interface';
import { ToolResult } from './tool-result.types';
import { ToolExecutor } from './tool.executor';
import { ToolRegistry, ToolDescriptor } from './tool.registry';

export interface ExecuteToolRequest {
  conversationId: string;
  toolName: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
  retries?: number;
}

export interface ToolExecutionRecord {
  id: string;
  conversationId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
}

export interface ExecuteToolResponse {
  execution: ToolExecutionRecord;
  result: ToolResult;
  message: MessageResponseDto;
}

interface ConversationClient {
  findFirst(args: { where: Record<string, unknown> }): Promise<{ id: string } | null>;
}

interface MessageClient {
  create(args: {
    data: {
      conversationId: string;
      role: 'TOOL';
      content: string;
      metadata: Prisma.InputJsonValue;
      tokenUsage: Prisma.InputJsonValue;
    };
  }): Promise<{
    id: string;
    conversationId: string;
    role: 'TOOL';
    content: string;
    metadata: Prisma.JsonValue;
    tokenUsage: Prisma.JsonValue;
    createdAt: Date;
  }>;
}

interface ToolExecutionClient {
  create(args: {
    data: {
      conversationId: string;
      toolName: string;
      input: Prisma.InputJsonValue;
      output: Prisma.InputJsonValue;
      status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';
      startedAt: Date;
      completedAt?: Date | null;
      durationMs?: number | null;
      error?: string | null;
    };
  }): Promise<{
    id: string;
    conversationId: string;
    toolName: string;
    input: Prisma.JsonValue;
    output: Prisma.JsonValue;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';
    startedAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    error: string | null;
    createdAt: Date;
  }>;
  update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{
    id: string;
    conversationId: string;
    toolName: string;
    input: Prisma.JsonValue;
    output: Prisma.JsonValue;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';
    startedAt: Date;
    completedAt: Date | null;
    durationMs: number | null;
    error: string | null;
    createdAt: Date;
  }>;
}

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly toolExecutor: ToolExecutor,
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
  ) {}

  listTools(): ToolDescriptor[] {
    return this.toolRegistry.list();
  }

  async executeTool(request: ExecuteToolRequest): Promise<ExecuteToolResponse> {
    this.toolRegistry.get(request.toolName);
    await this.assertConversationAccess(request.conversationId);

    const startedAt = new Date();
    const execution = await this.toolExecutions().create({
      data: {
        conversationId: request.conversationId,
        toolName: request.toolName,
        input: toJsonInput(request.input),
        output: {},
        status: 'RUNNING',
        startedAt,
      },
    });

    try {
      const result = await this.toolExecutor.execute({
        toolName: request.toolName,
        input: request.input,
        conversationId: request.conversationId,
        timeoutMs: request.timeoutMs,
        retries: request.retries,
      });

      const completedAt = new Date();
      const outputObject = toObject(result.output);

      const updatedExecution = await this.toolExecutions().update({
        where: { id: execution.id },
        data: {
          output: toJsonInput(outputObject),
          status: 'SUCCEEDED',
          completedAt,
          durationMs: result.durationMs,
          error: null,
        },
      });

      const toolMessage = await this.messages().create({
        data: {
          conversationId: request.conversationId,
          role: 'TOOL',
          content: JSON.stringify(outputObject, null, 2),
          metadata: toJsonInput({
            toolName: request.toolName,
            executionId: updatedExecution.id,
            status: updatedExecution.status,
            isError: false,
          }),
          tokenUsage: {},
        },
      });

      await this.auditService.record({
        action: 'execute',
        resource: 'ai_tool',
        resourceId: updatedExecution.id,
        metadata: {
          toolName: request.toolName,
          conversationId: request.conversationId,
          durationMs: updatedExecution.durationMs,
        },
      });

      return {
        execution: toExecutionRecord(updatedExecution),
        result: {
          toolName: request.toolName,
          content: JSON.stringify(outputObject, null, 2),
        },
        message: {
          id: toolMessage.id,
          conversationId: toolMessage.conversationId,
          role: 'tool',
          content: toolMessage.content,
          metadata: toObject(toolMessage.metadata),
          tokenUsage: toObject(toolMessage.tokenUsage),
          createdAt: toolMessage.createdAt.toISOString(),
        },
      };
    } catch (error) {
      const completedAt = new Date();
      const toolError =
        error instanceof ToolExecutionError
          ? error
          : new ToolExecutionError(
              error instanceof Error ? error.message : 'Tool execution failed',
              'tool_execution_failed',
            );
      const status = toolError.code === 'tool_timeout' ? 'TIMED_OUT' : 'FAILED';
      const errorMessage = `${toolError.code}: ${toolError.message}`;

      const updatedExecution = await this.toolExecutions().update({
        where: { id: execution.id },
        data: {
          output: {},
          status,
          completedAt,
          durationMs: completedAt.getTime() - startedAt.getTime(),
          error: errorMessage,
        },
      });

      const toolMessage = await this.messages().create({
        data: {
          conversationId: request.conversationId,
          role: 'TOOL',
          content: errorMessage,
          metadata: toJsonInput({
            toolName: request.toolName,
            executionId: updatedExecution.id,
            status: updatedExecution.status,
            isError: true,
            errorCode: toolError.code,
          }),
          tokenUsage: {},
        },
      });

      await this.auditService.record({
        action: 'execute',
        resource: 'ai_tool',
        resourceId: updatedExecution.id,
        metadata: {
          toolName: request.toolName,
          conversationId: request.conversationId,
          status,
          error: errorMessage,
          errorCode: toolError.code,
        },
      });

      this.logger.warn(
        {
          toolName: request.toolName,
          conversationId: request.conversationId,
          error: errorMessage,
        },
        'AI tool execution failed',
      );

      return {
        execution: toExecutionRecord(updatedExecution),
        result: {
          toolName: request.toolName,
          content: errorMessage,
          isError: true,
        },
        message: {
          id: toolMessage.id,
          conversationId: toolMessage.conversationId,
          role: 'tool',
          content: toolMessage.content,
          metadata: toObject(toolMessage.metadata),
          tokenUsage: toObject(toolMessage.tokenUsage),
          createdAt: toolMessage.createdAt.toISOString(),
        },
      };
    }
  }

  private async assertConversationAccess(conversationId: string): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    const conversation = await this.conversations().findFirst({
      where: {
        id: conversationId,
        organizationId: tenant.organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException(`Conversation with id "${conversationId}" not found`);
    }
  }

  private conversations(): ConversationClient {
    return (this.prisma.system as unknown as { conversation: ConversationClient }).conversation;
  }

  private messages(): MessageClient {
    return (this.prisma.system as unknown as { message: MessageClient }).message;
  }

  private toolExecutions(): ToolExecutionClient {
    return (this.prisma.system as unknown as { toolExecution: ToolExecutionClient }).toolExecution;
  }
}

function toJsonInput(value: unknown): Prisma.InputJsonValue {
  return value ?? {};
}

function toObject(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toExecutionRecord(record: {
  id: string;
  conversationId: string;
  toolName: string;
  input: Prisma.JsonValue;
  output: Prisma.JsonValue;
  status: 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED_OUT';
  startedAt: Date;
  completedAt: Date | null;
  durationMs: number | null;
  error: string | null;
  createdAt: Date;
}): ToolExecutionRecord {
  return {
    id: record.id,
    conversationId: record.conversationId,
    toolName: record.toolName,
    input: toObject(record.input),
    output: toObject(record.output),
    status: record.status,
    startedAt: record.startedAt,
    completedAt: record.completedAt,
    durationMs: record.durationMs,
    error: record.error,
    createdAt: record.createdAt,
  };
}
