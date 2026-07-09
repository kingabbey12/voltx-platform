// Must exactly match the redirectUri passed to initiateOAuth — Google
// validates the two match before issuing a token. Shared by the
// Integrations page (which starts the flow) and the callback page (which
// completes it) so they can never drift apart.
export function googleOAuthRedirectUri(): string {
  return `${window.location.origin}/integrations/callback`;
}

export const GOOGLE_PROVIDER_KEYS = ["GOOGLE_GMAIL", "GOOGLE_CALENDAR", "GOOGLE_DRIVE"] as const;
