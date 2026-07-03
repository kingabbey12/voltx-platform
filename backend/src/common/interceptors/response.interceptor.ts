import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { API_VERSION } from '../constants/api.constants';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  meta: {
    requestId: string | undefined;
    timestamp: string;
    version: string;
  };
}

const VERSIONED_API_PATH_PATTERN = /^\/api\/v\d+(\/|$)/;

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    if (!VERSIONED_API_PATH_PATTERN.test(path)) {
      return next.handle();
    }

    const requestIdHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    return next.handle().pipe(
      map((data: unknown) => ({
        success: true as const,
        data,
        meta: {
          requestId,
          timestamp: new Date().toISOString(),
          version: API_VERSION,
        },
      })),
    );
  }
}
