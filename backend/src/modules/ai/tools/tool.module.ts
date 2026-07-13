import { Injectable, Module } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { IsInt, IsObject, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { ApiSuccessResponseDto } from '../../../common/dto/api-response.dto';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import {
  AI_TOOLS,
  AITool,
  ToolExecutionError,
  ToolExecutionContext,
  ToolSchema,
} from './tool.interface';
import { OutboundHttpGuardService } from './outbound-http-guard.service';
import { ToolExecutor } from './tool.executor';
import { ToolRegistry } from './tool.registry';
import { ExecuteToolResponse, ToolService } from './tool.service';

class ToolDescriptorDto {
  name!: string;
  description!: string;
  inputSchema!: ToolSchema;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
}

class ToolExecutionResponseDto {
  execution!: ExecuteToolResponse['execution'];
  result!: ExecuteToolResponse['result'];
  message!: ExecuteToolResponse['message'];
}

class ToolListSuccessResponseDto extends ApiSuccessResponseDto<ToolDescriptorDto[]> {}
class ToolExecutionSuccessResponseDto extends ApiSuccessResponseDto<ToolExecutionResponseDto> {}

class ExecuteToolDto {
  @IsUUID()
  conversationId!: string;

  @IsString()
  toolName!: string;

  @IsObject()
  input!: Record<string, unknown>;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60000)
  timeoutMs?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(5)
  retries?: number;
}

@ApiTags('AI Tools')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS)
@Controller('ai/tools')
class ToolController {
  constructor(private readonly toolService: ToolService) {}

  @Get()
  @ApiOperation({ summary: 'List registered AI tools' })
  @ApiOkResponse({ type: ToolListSuccessResponseDto })
  list() {
    return this.toolService.listTools();
  }

  @Post('execute')
  @UseGuards(PermissionGuard)
  @Permissions('ai.tool.execute')
  @ApiOperation({ summary: 'Execute an AI tool for a conversation' })
  @ApiOkResponse({ type: ToolExecutionSuccessResponseDto })
  execute(@Body() dto: ExecuteToolDto): Promise<ExecuteToolResponse> {
    return this.toolService.executeTool(dto);
  }
}

class CalculatorTool implements AITool<{ expression: string }, { result: number }> {
  readonly name = 'calculator';
  readonly description = 'Evaluate a basic arithmetic expression.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      expression: {
        type: 'string',
        description: 'Arithmetic expression using numbers, parentheses, and + - * / % operators.',
        required: true,
      },
    },
  };

  execute(input: { expression: string }): Promise<{ result: number }> {
    const expression = input.expression.trim();
    if (!/^[0-9+\-*/%().\s]+$/u.test(expression)) {
      throw new ToolExecutionError(
        'Expression contains unsupported characters',
        'invalid_expression',
      );
    }

    const result = safeEvaluateExpression(expression);
    return Promise.resolve({ result });
  }
}

class DatetimeTool implements AITool<
  { timezone?: string },
  { iso: string; unixMs: number; timezone: string }
> {
  readonly name = 'datetime';
  readonly description = 'Return the current date and time.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      timezone: {
        type: 'string',
        description: 'Optional IANA timezone like UTC or Africa/Lagos.',
      },
    },
  };

  execute(input: {
    timezone?: string;
  }): Promise<{ iso: string; unixMs: number; timezone: string }> {
    const now = new Date();
    const timezone = input.timezone?.trim() || 'UTC';

    try {
      Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(now);
    } catch {
      throw new ToolExecutionError('Invalid timezone', 'invalid_timezone');
    }

    return Promise.resolve({
      iso: now.toISOString(),
      unixMs: now.getTime(),
      timezone,
    });
  }
}

class UuidTool implements AITool<{ count?: number }, { uuids: string[] }> {
  readonly name = 'uuid';
  readonly description = 'Generate one or more UUID values.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      count: {
        type: 'number',
        description: 'Optional number of UUIDs to generate, default 1, max 100.',
      },
    },
  };

  execute(input: { count?: number }): Promise<{ uuids: string[] }> {
    const count = Math.max(1, Math.min(100, Number(input.count ?? 1)));
    const uuids = Array.from({ length: count }, () => randomUUID());
    return Promise.resolve({ uuids });
  }
}

class JsonTool implements AITool<{ operation: string; value: unknown }, { result: unknown }> {
  readonly name = 'json';
  readonly description = 'Parse, stringify, or pretty-print JSON content.';
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        description: 'One of parse, stringify, or pretty.',
        required: true,
      },
      value: {
        type: 'object',
        description: 'JSON-compatible value or a JSON string depending on the operation.',
        required: true,
      },
    },
  };

  execute(input: { operation: string; value: unknown }): Promise<{ result: unknown }> {
    switch (input.operation) {
      case 'parse':
        if (typeof input.value !== 'string') {
          throw new ToolExecutionError(
            'Parse operation requires a string value',
            'invalid_json_input',
          );
        }
        return Promise.resolve({ result: JSON.parse(input.value) as unknown });
      case 'stringify':
        return Promise.resolve({ result: JSON.stringify(input.value) });
      case 'pretty':
        return Promise.resolve({ result: JSON.stringify(input.value, null, 2) });
      default:
        throw new ToolExecutionError('Unsupported json operation', 'invalid_json_operation');
    }
  }
}

@Injectable()
class HttpGetTool implements AITool<
  { url: string; headers?: Record<string, string> },
  { status: number; body: unknown }
> {
  readonly name = 'http_get';
  readonly description = 'Perform an HTTP GET request.';
  readonly defaultTimeoutMs = 10_000;
  readonly defaultRetries = 1;
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Absolute HTTP or HTTPS URL.',
        required: true,
      },
      headers: {
        type: 'object',
        description: 'Optional request headers.',
      },
    },
  };

  constructor(private readonly outboundHttpGuard: OutboundHttpGuardService) {}

  async execute(
    input: { url: string; headers?: Record<string, string> },
    context: ToolExecutionContext,
  ): Promise<{ status: number; body: unknown }> {
    const url = normalizeHttpUrl(input.url);
    const response = await this.outboundHttpGuard.fetch(url, this.name, {
      method: 'GET',
      headers: input.headers,
      signal: context.signal,
    });

    const body = await parseResponseBody(response);

    if (!response.ok && response.status >= 500) {
      throw new ToolExecutionError(
        `GET ${url} failed with status ${response.status}`,
        'http_get_failed',
        true,
      );
    }

    return {
      status: response.status,
      body,
    };
  }
}

@Injectable()
class HttpPostTool implements AITool<
  { url: string; headers?: Record<string, string>; body?: unknown },
  { status: number; body: unknown }
> {
  readonly name = 'http_post';
  readonly description = 'Perform an HTTP POST request.';
  readonly defaultTimeoutMs = 10_000;
  readonly defaultRetries = 1;
  readonly inputSchema: ToolSchema = {
    type: 'object',
    properties: {
      url: {
        type: 'string',
        description: 'Absolute HTTP or HTTPS URL.',
        required: true,
      },
      headers: {
        type: 'object',
        description: 'Optional request headers.',
      },
      body: {
        type: 'object',
        description: 'Optional JSON request body.',
      },
    },
  };

  constructor(private readonly outboundHttpGuard: OutboundHttpGuardService) {}

  async execute(
    input: { url: string; headers?: Record<string, string>; body?: unknown },
    context: ToolExecutionContext,
  ): Promise<{ status: number; body: unknown }> {
    const url = normalizeHttpUrl(input.url);
    const response = await this.outboundHttpGuard.fetch(url, this.name, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(input.headers ?? {}),
      },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
      signal: context.signal,
    });

    const body = await parseResponseBody(response);

    if (!response.ok && response.status >= 500) {
      throw new ToolExecutionError(
        `POST ${url} failed with status ${response.status}`,
        'http_post_failed',
        true,
      );
    }

    return {
      status: response.status,
      body,
    };
  }
}

@Module({
  imports: [ConfigModule],
  controllers: [ToolController],
  providers: [
    ToolRegistry,
    ToolExecutor,
    ToolService,
    OutboundHttpGuardService,
    CalculatorTool,
    DatetimeTool,
    UuidTool,
    JsonTool,
    HttpGetTool,
    HttpPostTool,
    {
      provide: AI_TOOLS,
      useFactory: (
        calculator: CalculatorTool,
        datetime: DatetimeTool,
        uuid: UuidTool,
        json: JsonTool,
        httpGet: HttpGetTool,
        httpPost: HttpPostTool,
      ) => [calculator, datetime, uuid, json, httpGet, httpPost],
      inject: [CalculatorTool, DatetimeTool, UuidTool, JsonTool, HttpGetTool, HttpPostTool],
    },
  ],
  // OutboundHttpGuardService is exported so other modules that need to
  // validate an attacker-influenced destination URL (e.g. the v2.3 Developer
  // Platform's OAuth redirect-URI registration) can reuse its
  // assertUrlIsSafeDestination() SSRF check rather than reimplementing it.
  exports: [ToolRegistry, ToolExecutor, ToolService, OutboundHttpGuardService],
})
export class ToolModule {}

function safeEvaluateExpression(expression: string): number {
  const parser = new ArithmeticParser(expression);
  const result = parser.parse();
  if (!Number.isFinite(result)) {
    throw new ToolExecutionError(
      'Expression did not produce a finite number',
      'invalid_expression_result',
    );
  }

  return result;
}

class ArithmeticParser {
  private readonly tokens: string[];
  private index = 0;

  constructor(expression: string) {
    this.tokens = expression.replace(/\s+/gu, '').match(/\d+(?:\.\d+)?|[()+\-*/%]/gu) ?? [];
  }

  parse(): number {
    if (this.tokens.length === 0) {
      throw new ToolExecutionError('Expression is empty', 'invalid_expression');
    }

    const value = this.parseExpression();
    if (this.current() !== undefined) {
      throw new ToolExecutionError('Expression could not be fully parsed', 'invalid_expression');
    }

    return value;
  }

  private parseExpression(): number {
    let value = this.parseTerm();

    while (this.current() === '+' || this.current() === '-') {
      const operator = this.consume();
      const right = this.parseTerm();
      value = operator === '+' ? value + right : value - right;
    }

    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();

    while (this.current() === '*' || this.current() === '/' || this.current() === '%') {
      const operator = this.consume();
      const right = this.parseFactor();

      switch (operator) {
        case '*':
          value *= right;
          break;
        case '/':
          value /= right;
          break;
        default:
          value %= right;
          break;
      }
    }

    return value;
  }

  private parseFactor(): number {
    const token = this.current();
    if (token === undefined) {
      throw new ToolExecutionError('Unexpected end of expression', 'invalid_expression');
    }

    if (token === '(') {
      this.consume();
      const value = this.parseExpression();
      if (this.consume() !== ')') {
        throw new ToolExecutionError('Missing closing parenthesis', 'invalid_expression');
      }
      return value;
    }

    if (token === '-') {
      this.consume();
      return -this.parseFactor();
    }

    if (!/^\d+(?:\.\d+)?$/u.test(token)) {
      throw new ToolExecutionError('Unexpected token in expression', 'invalid_expression');
    }

    this.consume();
    return Number(token);
  }

  private current(): string | undefined {
    return this.tokens[this.index];
  }

  private consume(): string | undefined {
    const token = this.tokens[this.index];
    this.index += 1;
    return token;
  }
}

function normalizeHttpUrl(rawUrl: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new ToolExecutionError('Invalid URL', 'invalid_url');
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new ToolExecutionError('Only HTTP and HTTPS URLs are allowed', 'invalid_url_protocol');
  }

  return parsedUrl.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') ?? '';
  const text = await response.text();

  if (text.trim().length === 0) {
    return {};
  }

  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text) as unknown;
    } catch {
      return { raw: text };
    }
  }

  return { raw: text };
}
