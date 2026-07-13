import { HttpException, HttpStatus } from '@nestjs/common';

export type OAuthWireErrorCode =
  | 'invalid_request'
  | 'invalid_client'
  | 'invalid_grant'
  | 'unauthorized_client'
  | 'unsupported_grant_type'
  | 'invalid_scope'
  | 'server_error';

/**
 * RFC 6749 §5.2 / RFC 7009 §5.2 error body (`{ error, error_description }`).
 * Thrown only from the OAuth token/revoke/introspect endpoints so
 * GlobalExceptionFilter can emit the standard OAuth2 wire shape instead of
 * this API's usual `{ success: false, error: { code, message } }` envelope
 * — no generic third-party OAuth2 client library understands the latter.
 */
export class OAuthWireException extends HttpException {
  constructor(
    status: HttpStatus,
    public readonly error: OAuthWireErrorCode,
    errorDescription: string,
  ) {
    super({ error, error_description: errorDescription }, status);
  }
}
