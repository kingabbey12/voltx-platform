import { VoltxApiError, VoltxClient } from "@voltx/sdk";
import { writeCredentials } from "../config.js";

export interface LoginOptions {
  baseUrl: string;
  organizationId: string;
}

/**
 * Logs the CLI in with a Personal Access Token the developer already
 * created (see `voltx.personalAccessTokens` / the Developer Portal's
 * Personal Access Tokens page). This is deliberately simpler than a
 * browser-based OAuth device flow: Phase 2's authorization server
 * supports authorization_code+PKCE and refresh_token grants, not a
 * device_code grant, and a genuine loopback-redirect OAuth flow would
 * additionally require a new web consent-screen page outside this
 * phase's scope — a pasted PAT is the same "create a token on the
 * dashboard, paste it here" pattern most CLIs (gh, heroku, stripe) use
 * for exactly this case, and is fully real today with zero new
 * dependencies.
 */
export async function login(token: string, options: LoginOptions): Promise<void> {
  const client = new VoltxClient({
    baseUrl: options.baseUrl,
    auth: { mode: "personal-access-token", token, organizationId: options.organizationId },
  });

  try {
    const whoami = await client.get<{ organizationId: string; permissions: string[] }>(
      "/developer/personal-access-tokens/whoami",
    );

    writeCredentials({ baseUrl: options.baseUrl, organizationId: options.organizationId, personalAccessToken: token });

    console.log(`Logged in to organization ${whoami.organizationId}.`);
    console.log(`Effective permissions: ${whoami.permissions.length}`);
  } catch (error) {
    if (error instanceof VoltxApiError) {
      throw new Error(`Login failed: ${error.message}`);
    }
    throw error;
  }
}
