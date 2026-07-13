import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { VoltxClient } from "../src/client.js";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("Resource methods build the expected request", () => {
  it("personalAccessTokens.create POSTs to /developer/personal-access-tokens", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(201, {
        success: true,
        data: { id: "pat-1", token: "vpat_raw" },
        meta: {},
      }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "personal-access-token", token: "vpat_x", organizationId: "org-1" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.personalAccessTokens.create({
      name: "CI script",
      scopedPermissions: ["organization.read"],
    });

    assert.equal(result.token, "vpat_raw");
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/developer/personal-access-tokens");
    assert.equal(init.method, "POST");
    assert.deepEqual(JSON.parse(init.body as string), {
      name: "CI script",
      scopedPermissions: ["organization.read"],
    });
  });

  it("serviceAccounts.suspend POSTs to the org-scoped suspend path", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(200, { success: true, data: { id: "sa-1", status: "SUSPENDED" }, meta: {} }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "api-key", apiKey: "vk_test" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.serviceAccounts.suspend("org-1", "sa-1");
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/organizations/org-1/service-accounts/sa-1/suspend");
    assert.equal(init.method, "POST");
  });

  it("webhookEndpoints.replayDelivery POSTs to the nested replay path", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(201, { success: true, data: { id: "delivery-2" }, meta: {} }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "api-key", apiKey: "vk_test" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    await client.webhookEndpoints.replayDelivery("org-1", "endpoint-1", "delivery-1");
    const [url] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(
      url,
      "https://api.test/api/v1/organizations/org-1/webhook-endpoints/endpoint-1/deliveries/delivery-1/replay",
    );
  });

  it("oauthApplications.exchangeAuthorizationCode hits the raw (un-enveloped) /oauth/token endpoint", async () => {
    const fetchMock = mock.fn(async () =>
      jsonResponse(200, {
        access_token: "voat_x",
        token_type: "Bearer",
        expires_in: 3600,
        refresh_token: "vort_x",
        scope: "organization.read",
      }),
    );
    const client = new VoltxClient({
      baseUrl: "https://api.test/api/v1",
      auth: { mode: "oauth", accessToken: "unused" },
      fetch: fetchMock as unknown as typeof fetch,
    });

    const result = await client.oauthApplications.exchangeAuthorizationCode({
      code: "auth-code",
      redirectUri: "https://example.com/callback",
      codeVerifier: "verifier",
      clientId: "client_1",
      clientSecret: "secret",
    });

    assert.equal(result.access_token, "voat_x");
    const [url, init] = fetchMock.mock.calls[0].arguments as [string, RequestInit];
    assert.equal(url, "https://api.test/api/v1/oauth/token");
    assert.deepEqual(JSON.parse(init.body as string), {
      grant_type: "authorization_code",
      code: "auth-code",
      redirect_uri: "https://example.com/callback",
      code_verifier: "verifier",
      client_id: "client_1",
      client_secret: "secret",
    });
  });
});
