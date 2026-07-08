export interface ApiSuccessEnvelope<T> {
  success: true;
  data: T;
  meta: {
    requestId: string;
    timestamp: string;
    version: string;
  };
}

export interface ApiErrorEnvelope {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: {
    requestId: string;
    timestamp: string;
    path: string;
    statusCode: number;
    version: string;
  };
}

export type ApiEnvelope<T> = ApiSuccessEnvelope<T> | ApiErrorEnvelope;

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
