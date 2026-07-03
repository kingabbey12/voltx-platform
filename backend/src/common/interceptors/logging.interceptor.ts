import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { Observable, tap } from 'rxjs';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const { method, originalUrl } = request;
    const requestIdHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        this.logger.log(
          {
            method,
            url: originalUrl,
            status: response.statusCode,
            duration: Date.now() - startedAt,
            requestId,
          },
          'HTTP request completed',
        );
      }),
    );
  }
}
