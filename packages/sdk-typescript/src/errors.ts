/** Mirrors the backend's ApiErrorEnvelope shape (src/common/filters/global-exception.filter.ts). */
export class VoltxApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly code: string | null = null,
    public readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = "VoltxApiError";
  }

  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  get isRateLimited(): boolean {
    return this.statusCode === 429;
  }

  get isNetworkFailure(): boolean {
    return this.statusCode === null;
  }
}
