import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { API_VERSION } from '../constants/api.constants';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';
import { ERROR_CODES, getDefaultErrorCode } from '../errors/error-codes';

interface ErrorResponseBody {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string | undefined;
    timestamp: string;
    path: string;
    statusCode: number;
    version: string;
  };
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: unknown =
      exception instanceof HttpException ? exception.getResponse() : 'Internal server error';

    const requestIdHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    if (status >= 500) {
      this.logger.error(
        {
          err: exception instanceof Error ? exception : undefined,
          requestId,
          path: request.url,
          method: request.method,
        },
        exception instanceof Error ? exception.message : 'Unhandled exception',
      );
    }

    const body: ErrorResponseBody = {
      success: false,
      error: this.normalizeError(status, exceptionResponse),
      meta: {
        requestId,
        timestamp: new Date().toISOString(),
        path: request.url,
        statusCode: status,
        version: API_VERSION,
      },
    };

    response.status(status).json(body);
  }

  private normalizeError(status: number, exceptionResponse: unknown): ErrorResponseBody['error'] {
    if (typeof exceptionResponse === 'string') {
      return {
        code: getDefaultErrorCode(status),
        message: exceptionResponse,
      };
    }

    if (!this.isRecord(exceptionResponse)) {
      return {
        code: getDefaultErrorCode(status),
        message: 'Request failed',
      };
    }

    const providedCode = exceptionResponse.code;
    const message = this.extractMessage(exceptionResponse.message) ?? 'Request failed';
    const details = this.extractDetails(exceptionResponse.message);

    return {
      code:
        typeof providedCode === 'string'
          ? providedCode
          : this.inferErrorCode(status, exceptionResponse.message),
      message,
      ...(details !== undefined ? { details } : {}),
    };
  }

  private inferErrorCode(status: number, message: unknown): string {
    if (Array.isArray(message)) {
      return ERROR_CODES.validationFailed;
    }

    return getDefaultErrorCode(status);
  }

  private extractMessage(message: unknown): string | undefined {
    if (typeof message === 'string') {
      return message;
    }

    if (Array.isArray(message) && message.length > 0) {
      return message.map((item) => String(item)).join(', ');
    }

    return undefined;
  }

  private extractDetails(message: unknown): unknown {
    if (Array.isArray(message)) {
      return message;
    }

    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
