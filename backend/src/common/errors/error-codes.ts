import { HttpStatus } from '@nestjs/common';

export const ERROR_CODES = {
  badRequest: 'BAD_REQUEST',
  validationFailed: 'VALIDATION_FAILED',
  unauthorized: 'UNAUTHORIZED',
  forbidden: 'FORBIDDEN',
  notFound: 'NOT_FOUND',
  conflict: 'CONFLICT',
  rateLimited: 'RATE_LIMITED',
  requestTimeout: 'REQUEST_TIMEOUT',
  payloadTooLarge: 'PAYLOAD_TOO_LARGE',
  unsupportedMediaType: 'UNSUPPORTED_MEDIA_TYPE',
  internalServerError: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export function getDefaultErrorCode(status: number): ErrorCode {
  const codeByStatus: Partial<Record<number, ErrorCode>> = {
    [HttpStatus.BAD_REQUEST]: ERROR_CODES.badRequest,
    [HttpStatus.UNAUTHORIZED]: ERROR_CODES.unauthorized,
    [HttpStatus.FORBIDDEN]: ERROR_CODES.forbidden,
    [HttpStatus.NOT_FOUND]: ERROR_CODES.notFound,
    [HttpStatus.CONFLICT]: ERROR_CODES.conflict,
    [HttpStatus.TOO_MANY_REQUESTS]: ERROR_CODES.rateLimited,
    [HttpStatus.REQUEST_TIMEOUT]: ERROR_CODES.requestTimeout,
    [HttpStatus.PAYLOAD_TOO_LARGE]: ERROR_CODES.payloadTooLarge,
    [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ERROR_CODES.unsupportedMediaType,
  };

  return codeByStatus[status] ?? ERROR_CODES.internalServerError;
}
