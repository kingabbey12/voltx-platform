import { requestJson } from '../../provider/integration-http-client.util';
import { IntegrationCredentialValue } from '../../provider/integration-provider.types';

const USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

interface GoogleUserInfoResponse {
  email?: string;
}

/**
 * Shared by all three Google connectors (Gmail/Calendar/Drive) rather than
 * each hand-rolling its own userinfo call — one real request to Google's
 * OAuth2 userinfo endpoint, requires the `userinfo.email` scope granted
 * alongside the connector's own service scope. Returns undefined (not a
 * fabricated placeholder) if the call fails for any reason — a connection
 * still works without a displayed email, it just shows less detail.
 */
export async function resolveGoogleAccountEmail(
  credential: IntegrationCredentialValue,
): Promise<string | undefined> {
  if (!credential.accessToken) return undefined;

  try {
    const result = await requestJson<GoogleUserInfoResponse>(USERINFO_URL, {
      headers: { Authorization: `Bearer ${credential.accessToken}` },
    });
    return result.body.email;
  } catch {
    return undefined;
  }
}
