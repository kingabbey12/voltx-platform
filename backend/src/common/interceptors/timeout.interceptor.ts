import {
  CallHandler,
  ExecutionContext,
  GatewayTimeoutException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, TimeoutError, catchError, throwError, timeout } from 'rxjs';

const DEFAULT_TIMEOUT_MS = 30_000;

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(DEFAULT_TIMEOUT_MS),
      catchError((error: unknown) => {
        if (error instanceof TimeoutError) {
          return throwError(() => new GatewayTimeoutException('Request timed out'));
        }
        return throwError(() => error);
      }),
    );
  }
}
