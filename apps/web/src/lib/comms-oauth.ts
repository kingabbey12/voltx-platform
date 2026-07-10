// Must exactly match the redirectUri passed to communicationsApi.initiateOAuth
// — the provider validates the two match before issuing a token. Distinct
// from lib/google-oauth.ts's redirect (that one is for the Integrations
// page's Google connectors; this is for Communications channels — same
// provider, different connection system, different callback route).
export function commsOAuthRedirectUri(): string {
  return `${window.location.origin}/settings/communications/callback`;
}
