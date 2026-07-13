import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { captureException } from '../../error-reporting';
import {
  AIProviderError,
  AIProviderErrorCategory,
} from '../../modules/ai/providers/ai-provider.interface';
import { OAuthWireException } from '../../modules/oauth-provider/errors/oauth-wire.exception';
import { API_VERSION } from '../constants/api.constants';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';
import { ERROR_CODES, ErrorCode, getDefaultErrorCode } from '../errors/error-codes';

const AI_ERROR_STATUS_BY_CATEGORY: Record<AIProviderErrorCategory, number> = {
  invalid_api_key: HttpStatus.SERVICE_UNAVAILABLE,
  insufficient_credits: HttpStatus.SERVICE_UNAVAILABLE,
  rate_limited: HttpStatus.TOO_MANY_REQUESTS,
  context_length_exceeded: HttpStatus.BAD_REQUEST,
  provider_unavailable: HttpStatus.SERVICE_UNAVAILABLE,
  timeout: HttpStatus.GATEWAY_TIMEOUT,
  unknown: HttpStatus.SERVICE_UNAVAILABLE,
};

const AI_ERROR_CODE_BY_CATEGORY: Record<AIProviderErrorCategory, ErrorCode> = {
  invalid_api_key: ERROR_CODES.aiInvalidApiKey,
  insufficient_credits: ERROR_CODES.aiInsufficientCredits,
  rate_limited: ERROR_CODES.aiRateLimited,
  context_length_exceeded: ERROR_CODES.aiContextLengthExceeded,
  provider_unavailable: ERROR_CODES.aiServiceUnavailable,
  timeout: ERROR_CODES.aiTimeout,
  unknown: ERROR_CODES.aiServiceUnavailable,
};

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

    // OAuth token/revoke/introspect errors must be RFC 6749/7009-shaped
    // (`{ error, error_description }`), never this API's normal envelope —
    // no generic OAuth2 client library parses the latter. OAuthWireException
    // is only ever thrown from the OAuth provider's token flows, so this
    // check is exhaustive for that surface without needing a path match.
    if (exception instanceof OAuthWireException) {
      response.status(exception.getStatus()).json(exception.getResponse());
      return;
    }

    // AIProviderError is a plain Error (not an HttpException, since it's
    // thrown from deep inside provider/runtime code with no HTTP context),
    // so without this check it would fall through to a generic 500 —
    // hiding the real, actionable cause (quota exceeded, provider rate
    // limited, provider outage) from every caller, including the mobile
    // app's error-message mapping and any on-call engineer reading a
    // client-reported error rather than the server log. exception.message
    // on an AIProviderError is always the pre-classified, user-safe text
    // (see provider-error-classifier.ts) — the raw provider response lives
    // separately on .providerDetail and is only ever logged, never
    // returned in the response body below.
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : exception instanceof AIProviderError
          ? AI_ERROR_STATUS_BY_CATEGORY[exception.category]
          : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: unknown =
      exception instanceof HttpException
        ? exception.getResponse()
        : exception instanceof AIProviderError
          ? { code: AI_ERROR_CODE_BY_CATEGORY[exception.category], message: exception.message }
          : 'Internal server error';

    const requestIdHeader = request.headers[REQUEST_ID_HEADER];
    const requestId = typeof requestIdHeader === 'string' ? requestIdHeader : undefined;

    if (exception instanceof AIProviderError) {
      // Always logged regardless of status — an AIProviderError is never
      // routine, and this is the one place guaranteed to see every such
      // error regardless of which call path threw it (some, like
      // assertConfigured(), never go through provider-http.utils.ts's own
      // logging at all).
      this.logger.error(
        {
          requestId,
          path: request.url,
          category: exception.category,
          code: exception.code,
          retryable: exception.retryable,
          providerDetail: exception.providerDetail,
        },
        `AI provider error reached the client boundary: ${exception.category}`,
      );
    }

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
      captureException(exception);
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
    const details = this.extractDetails(exceptionResponse);

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

  /**
   * Validation errors (class-validator's array-of-strings `message`) are
   * the original, longest-standing shape here; an explicit `details`
   * property on the thrown exception's response object (e.g.
   * FeatureGateGuard's `{code, message, details: {featureKey, limit,
   * currentUsage}}`) is a newer, equally-valid way for a handler to
   * surface structured data the client needs to act on the error.
   */
  private extractDetails(exceptionResponse: Record<string, unknown>): unknown {
    if (Array.isArray(exceptionResponse.message)) {
      return exceptionResponse.message;
    }

    if ('details' in exceptionResponse) {
      return exceptionResponse.details;
    }

    return undefined;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }
}
