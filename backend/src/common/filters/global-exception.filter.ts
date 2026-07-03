import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';

interface ErrorResponseBody {
  statusCode: number;
  timestamp: string;
  path: string;
  requestId: string | undefined;
  message: string | Record<string, unknown>;
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

    const exceptionResponse =
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
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      requestId,
      message:
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>),
    };

    response.status(status).json(body);
  }
}
