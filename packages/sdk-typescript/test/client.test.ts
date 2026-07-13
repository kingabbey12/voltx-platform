import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { VoltxApiError } from "../src/errors.js";
import { VoltxClient } from "../src/client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("VoltxClient — auth header injection", () => {
  it("sends X-Api-Key for api-key auth", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fetchMock = mock.fn(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return jsonResponse(200, { success: true, data: [], meta: {} });
    });

    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "api-key", apiKey: "vk_test123" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.get("/anything");
    assert.equal((capturedHeaders as Record<string, string>)["X-Api-Key"], "vk_test123");
  });

  it("sends X-Personal-Access-Token and X-Organization-Id for personal-access-token auth", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fetchMock = mock.fn(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return jsonResponse(200, { success: true, data: [], meta: {} });
    });

    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "personal-access-token", token: "vpat_abc", organizationId: "org-1" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.get("/anything");
    const headers = capturedHeaders as Record<string, string>;
    assert.equal(headers["X-Personal-Access-Token"], "vpat_abc");
    assert.equal(headers["X-Organization-Id"], "org-1");
  });

  it("sends Authorization: Bearer for oauth auth", async () => {
    let capturedHeaders: HeadersInit | undefined;
    const fetchMock = mock.fn(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers;
      return jsonResponse(200, { success: true, data: [], meta: {} });
    });

    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "oauth", accessToken: "voat_xyz" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.get("/anything");
    assert.equal((capturedHeaders as Record<string, string>).Authorization, "Bearer voat_xyz");
  });
});

describe("VoltxClient — envelope unwrapping", () => {
  it("returns the unwrapped data on a successful envelope", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(200, { success: true, data: { id: "pat-1" }, meta: {} }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "api-key", apiKey: "vk_test" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.get<{ id: string }>("/developer/personal-access-tokens");
    assert.deepEqual(result, { id: "pat-1" });
  });
});

describe("VoltxClient — error mapping", () => {
  it("throws a VoltxApiError with the envelope's error code/message on failure", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(403, {
        success: false,
        error: { code: "FORBIDDEN", message: "Missing required permissions" },
        meta: {},
      }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "api-key", apiKey: "vk_test" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await assert.rejects(
      () => client.get("/organizations/org-1/service-accounts"),
      (error: unknown) => {
        assert.ok(error instanceof VoltxApiError);
        assert.equal(error.statusCode, 403);
        assert.equal(error.code, "FORBIDDEN");
        assert.equal(error.isForbidden, true);
        return true;
      },
    );
  });

  it("throws a network-failure VoltxApiError (statusCode null) when fetch itself throws", async () => {
    const fetchMock = mock.fn(async () => {
      throw new Error("getaddrinfo ENOTFOUND");
    });
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "api-key", apiKey: "vk_test" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await assert.rejects(
      () => client.get("/anything"),
      (error: unknown) => {
        assert.ok(error instanceof VoltxApiError);
        assert.equal(error.isNetworkFailure, true);
        return true;
      },
    );
  });
});

describe("VoltxClient — OAuth retry-on-401", () => {
  it("refreshes the access token exactly once and retries the original request", async () => {
    let call = 0;
    const fetchMock = mock.fn(async (url: string) => {
      call += 1;
      if (call === 1) {
        // First attempt with the stale access token — unauthorized.
        return jsonResponse(401, {
          success: false,
          error: { code: "UNAUTHORIZED", message: "Invalid or expired access token" },
          meta: {},
        });
      }
      if (String(url).endsWith("/oauth/token")) {
        return jsonResponse(200, {
          access_token: "voat_new",
          token_type: "Bearer",
          expires_in: 3600,
          refresh_token: "vort_new",
          scope: "sales.opportunity.read",
        });
      }
      // Retried request with the refreshed token.
      return jsonResponse(200, { success: true, data: { ok: true }, meta: {} });
    });

    let refreshedTokens: unknown;
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: {
        mode: "oauth",
        accessToken: "voat_stale",
        refreshToken: "vort_stale",
        clientId: "client_1",
        clientSecret: "vcs_secret",
        onTokensRefreshed: (tokens) => {
          refreshedTokens = tokens;
        },
      },
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.get<{ ok: boolean }>("/oauth/whoami");
    assert.deepEqual(result, { ok: true });
    assert.equal(fetchMock.mock.calls.length, 3);
    assert.ok(refreshedTokens);
  });

  it("does not attempt a refresh when no refreshToken is configured", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(401, {
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid token" },
        meta: {},
      }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "oauth", accessToken: "voat_stale" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await assert.rejects(() => client.get("/oauth/whoami"), VoltxApiError);
    assert.equal(fetchMock.mock.calls.length, 1);
  });
});
