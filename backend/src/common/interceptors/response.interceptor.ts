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

/**
 * SCIM 2.0 (RFC 7644) is a wire protocol every IdP's own connector parses
 * directly — `response.body.id`/`userName`/`Resources`, never a wrapped
 * envelope. Wrapping these in `{ success, data, meta }` like every other
 * endpoint would silently break every real SCIM client integration, so
 * SCIM routes are the one exception to the envelope, matched by path
 * rather than by opting every SCIM controller out of both the global
 * `api` prefix and URI versioning individually.
 */
const SCIM_PATH_PATTERN = /^\/api\/v\d+\/scim\//;

/**
 * The OAuth 2.0 token/revoke/introspect endpoints (RFC 6749/7009/7662) are
 * called directly by a third party's own generic OAuth2 client library,
 * never by Voltx's own web/mobile apps — those libraries parse the
 * standard `access_token`/`error`/`active` wire shape, not this API's
 * `{ success, data, meta }` envelope. Matched by path for the same reason
 * SCIM is above. GET/POST /oauth/authorize (the consent flow, called only
 * by Voltx's own web app) deliberately stays enveloped and is NOT matched
 * by this pattern.
 */
const OAUTH_TOKEN_ENDPOINT_PATH_PATTERN = /^\/api\/v\d+\/oauth\/(token|revoke|introspect)$/;

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const path = request.path;

    if (
      !VERSIONED_API_PATH_PATTERN.test(path) ||
      SCIM_PATH_PATTERN.test(path) ||
      OAUTH_TOKEN_ENDPOINT_PATH_PATTERN.test(path)
    ) {
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
