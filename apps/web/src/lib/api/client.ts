import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "./token-storage";
import { ApiError } from "./api-error";
import type { ApiEnvelope } from "./types";

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Attach the bearer access token. Defaults to true. */
  authenticated?: boolean;
  /** Internal — prevents infinite refresh loops. */
  _isRetry?: boolean;
}

/** Invoked when a refresh attempt fails — the auth layer registers this to
 * clear session state and redirect to /login. Kept as a settable callback
 * (rather than importing the auth store here) to avoid a circular
 * dependency between the API client and the auth state that depends on it. */
let onSessionExpired: (() => void) | null = null;
export function registerSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${API_BASE_URL}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

// Deduplicates concurrent refresh attempts — if 5 requests 401 at once,
// only one refresh call fires and all 5 await the same promise.
let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.readRefreshToken();
    if (!refreshToken) {
      throw new ApiError("No refresh token available", 401);
    }

    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
    });

    const json = (await response.json()) as ApiEnvelope<{
      accessToken: string;
      refreshToken: string;
    }>;

    if (!response.ok || !json.success) {
      throw new ApiError("Session expired", 401);
    }

    tokenStorage.save({
      accessToken: json.data.accessToken,
      refreshToken: json.data.refreshToken,
    });
    return json.data.accessToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, authenticated = true, _isRetry = false } = options;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (authenticated) {
    const accessToken = tokenStorage.readAccessToken();
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError("Network request failed", null);
  }

  let json: ApiEnvelope<T> | null = null;
  try {
    json = (await response.json()) as ApiEnvelope<T>;
  } catch {
    // No JSON body (e.g. 204) — fine for success responses.
  }

  if (response.ok && json?.success) {
    return json.data;
  }

  // 401 on an authenticated request that isn't already a retry: attempt
  // exactly one silent refresh-and-retry before giving up.
  if (response.status === 401 && authenticated && !_isRetry) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, { ...options, _isRetry: true });
    } catch {
      tokenStorage.clear();
      onSessionExpired?.();
      throw new ApiError("Session expired", 401, "SESSION_EXPIRED");
    }
  }

  const errorEnvelope = json && !json.success ? json : null;
  throw new ApiError(
    errorEnvelope?.error.message ?? `Request failed with status ${response.status}`,
    response.status,
    errorEnvelope?.error.code ?? null,
    errorEnvelope?.error.details,
  );
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body">) =>
    apiFetch<T>(path, { ...options, method: "DELETE" }),
};
