import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "./token-storage";
import { ApiError } from "./api-error";
import type { ApiEnvelope } from "./types";

/** Default request timeout in milliseconds — all apiFetch calls use this
 * unless overridden via options. Picked to balance responsiveness against
 * legitimate long-running operations (AI agent runs are exempted via their
 * own streaming/SSE paths). */
const REQUEST_TIMEOUT_MS = 30_000;

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  /** Attach the bearer access token. Defaults to true. */
  authenticated?: boolean;
  /** Internal — prevents infinite refresh loops. */
  _isRetry?: boolean;
  /** AbortSignal for external cancellation (e.g. React Query's
   * AbortSignal, user-initiated cancellation via a Cancel button, or
   * component unmount). */
  signal?: AbortSignal;
  /** Per-request timeout override in milliseconds. When unset the default
   * REQUEST_TIMEOUT_MS applies. Set to 0 to disable the timeout entirely
   * (for long-running operations like large file uploads that manage their
   * own cancellation via a separate AbortSignal). */
  timeoutMs?: number;
}

/** Invoked when a refresh attempt fails — the auth layer registers this to
 * clear session state and redirect to /login. Kept as a settable callback
 * (rather than importing the auth store here) to avoid a circular
 * dependency between the API client and the auth state that depends on it. */
let onSessionExpired: (() => void) | null = null;
export function registerSessionExpiredHandler(handler: () => void): void {
  onSessionExpired = handler;
}

/** Invoked when a 401 arrives while impersonating (v2.2 Customer Success)
 * — the SupportSession ended or expired server-side. The platform admin's
 * own tokens are already restored by the time this fires (see the 401
 * branch below); the auth layer registers this to refresh `me()` under
 * the restored session and navigate back to the platform console. */
let onImpersonationEnded: (() => void) | null = null;
export function registerImpersonationEndedHandler(handler: () => void): void {
  onImpersonationEnded = handler;
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

/** Shorter timeout for the refresh call — a slow refresh should never
 * block a retry indefinitely (the user gets a "Session expired" result
 * faster and can re-login instead of staring at a spinner). */
const REFRESH_TIMEOUT_MS = 10_000;

async function refreshAccessToken(): Promise<string> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    const refreshToken = tokenStorage.readRefreshToken();
    if (!refreshToken) {
      throw new ApiError("No refresh token available", 401);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(new ApiError("Refresh timed out", 408, "REFRESH_TIMEOUT")),
      REFRESH_TIMEOUT_MS,
    );

    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
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
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, authenticated = true, _isRetry = false, signal: externalSignal, timeoutMs = REQUEST_TIMEOUT_MS } = options;

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

  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  if (timeoutMs > 0) {
    timeoutId = setTimeout(() => controller.abort(new ApiError("Request timed out", 408, "REQUEST_TIMEOUT")), timeoutMs);
  }

  if (externalSignal) {
    const onExternalAbort = () => controller.abort(externalSignal.reason);
    externalSignal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const signal = controller.signal;

  let response: Response;
  try {
    const requestUrl = buildUrl(path, query);
    console.log("API REQUEST:", requestUrl);
    response = await fetch(requestUrl, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new ApiError("Request was cancelled or timed out", 408, "REQUEST_TIMEOUT");
    }
    throw new ApiError("Network request failed", null);
  } finally {
    clearTimeout(timeoutId);
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
    // Impersonation access tokens have no refresh token (by design — see
    // AuthService.issueImpersonationAccessToken) — a 401 here means the
    // SupportSession was ended or expired server-side, not a normal
    // expiry. Restore the admin's own session instead of attempting (and
    // failing) a refresh with their real refresh token under a stale
    // impersonated org context.
    if (tokenStorage.getImpersonationStash()) {
      tokenStorage.endImpersonation();
      onImpersonationEnded?.();
      throw new ApiError("Support session has ended", 401, "SUPPORT_SESSION_ENDED");
    }

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
