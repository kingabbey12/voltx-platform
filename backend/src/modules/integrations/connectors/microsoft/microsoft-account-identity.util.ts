import { requestJson } from '../../provider/integration-http-client.util';
import { IntegrationCredentialValue } from '../../provider/integration-provider.types';

const ME_URL = 'https://graph.microsoft.com/v1.0/me';

interface GraphMeResponse {
  mail?: string;
  userPrincipalName?: string;
}

/**
 * Shared by the Outlook and Teams connectors — one real request to Graph's
 * /me endpoint rather than each connector hand-rolling its own. `mail` is
 * unset for some account types (e.g. certain guest accounts), so falls
 * back to userPrincipalName, which is always present. Returns undefined
 * (not a fabricated placeholder) if the call fails — a connection still
 * works without a displayed identity, it just shows less detail.
 */
export async function resolveMicrosoftAccountIdentity(
  credential: IntegrationCredentialValue,
): Promise<string | undefined> {
  if (!credential.accessToken) return undefined;

  try {
    const result = await requestJson<GraphMeResponse>(ME_URL, {
      headers: { Authorization: `Bearer ${credential.accessToken}` },
    });
    return result.body.mail ?? result.body.userPrincipalName;
  } catch {
    return undefined;
  }
}
