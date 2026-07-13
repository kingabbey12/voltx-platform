import { VoltxApiError } from "./errors.js";
import type { ApiEnvelope, OAuthTokenResponse } from "./types.js";
import { OAuthApplicationsResource } from "./resources/oauth-applications.js";
import { PersonalAccessTokensResource } from "./resources/personal-access-tokens.js";
import { ServiceAccountsResource } from "./resources/service-accounts.js";
import { WebhookEndpointsResource } from "./resources/webhook-endpoints.js";

/**
 * One of every credential type the backend accepts (see AUTH_GUARDS
 * alternatives across src/modules/security, developer-platform, and
 * oauth-provider) — the SDK picks the matching header(s) for whichever
 * mode is configured.
 */
export type VoltxAuth =
  | { mode: "api-key"; apiKey: string }
  | { mode: "personal-access-token"; token: string; organizationId: string }
  | { mode: "service-account-token"; token: string }
  | {
      mode: "oauth";
      accessToken: string;
      /** Enables the automatic retry-on-401 refresh flow below. */
      refreshToken?: string;
      clientId?: string;
      clientSecret?: string;
      onTokensRefreshed?: (tokens: OAuthTokenResponse) => void;
    };

export interface VoltxClientOptions {
  /** e.g. "https://api.usevoltx.com/api/v1" — no default; every consumer
   * must set this explicitly rather than silently talking to a guessed
   * host. */
  baseUrl: string;
  auth: VoltxAuth;
  /** Injectable for testing; defaults to the global fetch. */
  fetch?: typeof fetch;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  _isRetry?: boolean;
}

export class VoltxClient {
  private readonly baseUrl: string;
  private auth: VoltxAuth;
  private readonly fetchImpl: typeof fetch;

  readonly personalAccessTokens = new PersonalAccessTokensResource(this);
  readonly serviceAccounts = new ServiceAccountsResource(this);
  readonly oauthApplications = new OAuthApplicationsResource(this);
  readonly webhookEndpoints = new WebhookEndpointsResource(this);

  constructor(options: VoltxClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.auth = options.auth;
    this.fetchImpl = options.fetch ?? fetch;
  }

  private buildUrl(path: string, query?: RequestOptions["query"]): string {
    const url = new URL(`${this.baseUrl}${path}`);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  private authHeaders(): Record<string, string> {
    switch (this.auth.mode) {
      case "api-key":
        return { "X-Api-Key": this.auth.apiKey };
      case "personal-access-token":
        return {
          "X-Personal-Access-Token": this.auth.token,
          "X-Organization-Id": this.auth.organizationId,
        };
      case "service-account-token":
        return { "X-Service-Account-Token": this.auth.token };
      case "oauth":
        return { Authorization: `Bearer ${this.auth.accessToken}` };
    }
  }

  /** POST /oauth/token with the refresh_token grant — only usable when
   * auth mode is "oauth" with refreshToken/clientId/clientSecret set. */
  private async refreshOAuthAccessToken(): Promise<void> {
    if (this.auth.mode !== "oauth" || !this.auth.refreshToken || !this.auth.clientId || !this.auth.clientSecret) {
      throw new VoltxApiError(
        "Cannot refresh: auth mode is not oauth, or refreshToken/clientId/clientSecret is missing",
        401,
      );
    }

    const response = await this.fetchImpl(this.buildUrl("/oauth/token"), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: this.auth.refreshToken,
        client_id: this.auth.clientId,
        client_secret: this.auth.clientSecret,
      }),
    });

    const body = (await response.json()) as OAuthTokenResponse | { error: string; error_description: string };
    if (!response.ok || !("access_token" in body)) {
      const message = "error_description" in body ? body.error_description : "OAuth token refresh failed";
      throw new VoltxApiError(message, response.status, "error" in body ? body.error : null);
    }

    this.auth = {
      ...this.auth,
      accessToken: body.access_token,
      refreshToken: body.refresh_token,
    };
    this.auth.onTokensRefreshed?.(body);
  }

  /** Used for the three raw RFC 6749/7009/7662 OAuth endpoints, which
   * return un-enveloped JSON rather than {success,data,meta}. */
  async rawRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, query } = options;
    const response = await this.fetchImpl(this.buildUrl(path, query), {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json", Accept: "application/json" } : { Accept: "application/json" },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json()) as T & { error?: string; error_description?: string };
    if (!response.ok) {
      throw new VoltxApiError(json.error_description ?? "Request failed", response.status, json.error ?? null);
    }
    return json;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = "GET", body, query, _isRetry = false } = options;

    const headers: Record<string, string> = { Accept: "application/json", ...this.authHeaders() };
    if (body !== undefined) headers["Content-Type"] = "application/json";

    let response: Response;
    try {
      response = await this.fetchImpl(this.buildUrl(path, query), {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new VoltxApiError("Network request failed", null);
    }

    let json: ApiEnvelope<T> | null = null;
    try {
      json = (await response.json()) as ApiEnvelope<T>;
    } catch {
      // No JSON body (e.g. a 204) — fine for success responses.
    }

    if (response.ok && json?.success) {
      return json.data;
    }

    if (response.status === 401 && this.auth.mode === "oauth" && this.auth.refreshToken && !_isRetry) {
      await this.refreshOAuthAccessToken();
      return this.request<T>(path, { ...options, _isRetry: true });
    }

    const errorEnvelope = json && !json.success ? json : null;
    throw new VoltxApiError(
      errorEnvelope?.error.message ?? `Request failed with status ${response.status}`,
      response.status,
      errorEnvelope?.error.code ?? null,
      errorEnvelope?.error.details,
    );
  }

  get<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "GET" });
  }
  post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "POST", body });
  }
  patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "PATCH", body });
  }
  delete<T>(path: string, options?: Omit<RequestOptions, "method" | "body">): Promise<T> {
    return this.request<T>(path, { ...options, method: "DELETE" });
  }
}
