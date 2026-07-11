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

export const API_BASE_URL = configuredApiBaseUrl;
