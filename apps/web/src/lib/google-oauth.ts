// Must exactly match the redirectUri passed to initiateOAuth — every
// provider validates the two match before issuing a token. Shared by the
// Integrations page (which starts the flow, for any OAuth2 provider) and
// the callback page (which completes it) so they can never drift apart.
// One callback route handles every provider: the OAuth `state` carries the
// connectionId, and the backend looks up which provider that connection is
// for, so the redirect URI itself never needs to be provider-specific.
export function integrationOAuthRedirectUri(): string {
  return `${window.location.origin}/integrations/callback`;
}

export const GOOGLE_PROVIDER_KEYS = ["GOOGLE_GMAIL", "GOOGLE_CALENDAR", "GOOGLE_DRIVE"] as const;
