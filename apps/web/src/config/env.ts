// Server-configurable via NEXT_PUBLIC_API_BASE_URL. No production
// fallback: a missing value used to silently resolve to the real
// production backend, so a local/staging build with no env file
// configured would talk to production without anyone noticing. Every
// environment (including local dev — see .env.local) must set this
// explicitly.
const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

if (!configuredApiBaseUrl) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL is not set. Add it to .env.local (or the deployment's " +
      "environment configuration) — there is no default backend URL.",
  );
}

// Every API call in this app builds its URL as `${API_BASE_URL}${path}` (see
// lib/api/client.ts), where `path` is always a bare route like "/auth/login"
// — never a full URL. If NEXT_PUBLIC_API_BASE_URL is ever mistakenly set to
// an endpoint URL instead of the bare API root (e.g. copy-pasted as
// ".../api/v1/auth/login" instead of ".../api/v1"), every request silently
// gets the endpoint path appended a second time (e.g.
// ".../auth/login/auth/login") instead of failing loudly. Since
// NEXT_PUBLIC_* values are inlined into the client bundle at build time, a
// bad value here isn't caught by working source code — it has to be caught
// here, at the point the value is read.
let parsedApiBaseUrl: URL;
try {
  parsedApiBaseUrl = new URL(configuredApiBaseUrl);
} catch {
  throw new Error(
    `NEXT_PUBLIC_API_BASE_URL ("${configuredApiBaseUrl}") is not a valid absolute URL. ` +
      'Set it to just the origin + version prefix (e.g. "https://api.usevoltx.com/api/v1").',
  );
}

if (/\/(auth|login|health)(\/|$)/i.test(parsedApiBaseUrl.pathname)) {
  throw new Error(
    `NEXT_PUBLIC_API_BASE_URL ("${configuredApiBaseUrl}") looks like it includes a specific ` +
      'endpoint path, not the bare API root. Set it to just the origin + version prefix ' +
      '(e.g. "https://api.usevoltx.com/api/v1"), with no trailing route segment.',
  );
}

export const API_BASE_URL = configuredApiBaseUrl.replace(/\/+$/, "");
