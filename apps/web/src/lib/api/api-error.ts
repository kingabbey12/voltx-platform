export class ApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number | null,
    public readonly code: string | null = null,
    public readonly details: unknown = undefined,
  ) {
    super(message);
    this.name = "ApiError";
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

  get isValidation(): boolean {
    return this.statusCode === 400 || this.statusCode === 422;
  }

  get isNetworkFailure(): boolean {
    return this.statusCode === null;
  }
}

export function friendlyErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.isNetworkFailure) {
      return "Can't reach Voltx right now. Check your connection and try again.";
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}
