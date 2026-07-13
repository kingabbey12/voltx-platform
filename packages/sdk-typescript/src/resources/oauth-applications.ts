import type { VoltxClient } from "../client.js";
import type { components } from "../generated/schema.js";
import type {
  CreateOAuthApplicationResult,
  OAuthApplication,
  OAuthIntrospectResponse,
  OAuthTokenResponse,
  RotateOAuthApplicationSecretResult,
} from "../types.js";

export type CreateOAuthApplicationInput = components["schemas"]["CreateOAuthApplicationDto"];
export type UpdateOAuthApplicationInput = components["schemas"]["UpdateOAuthApplicationDto"];

export interface ExchangeAuthorizationCodeInput {
  code: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  clientSecret: string;
}
export interface RefreshOAuthTokenInput {
  refreshToken: string;
  clientId: string;
  clientSecret: string;
}
export interface RevokeOAuthTokenInput {
  token: string;
  tokenTypeHint?: "access_token" | "refresh_token";
  clientId: string;
  clientSecret: string;
}
export interface IntrospectOAuthTokenInput {
  token: string;
  clientId: string;
  clientSecret: string;
}

export class OAuthApplicationsResource {
  constructor(private readonly client: VoltxClient) {}

  list(organizationId: string): Promise<OAuthApplication[]> {
    return this.client.get<OAuthApplication[]>(`/organizations/${organizationId}/oauth-applications`);
  }

  create(organizationId: string, input: CreateOAuthApplicationInput): Promise<CreateOAuthApplicationResult> {
    return this.client.post<CreateOAuthApplicationResult>(
      `/organizations/${organizationId}/oauth-applications`,
      input,
    );
  }

  get(organizationId: string, id: string): Promise<OAuthApplication> {
    return this.client.get<OAuthApplication>(`/organizations/${organizationId}/oauth-applications/${id}`);
  }

  update(organizationId: string, id: string, input: UpdateOAuthApplicationInput): Promise<OAuthApplication> {
    return this.client.patch<OAuthApplication>(
      `/organizations/${organizationId}/oauth-applications/${id}`,
      input,
    );
  }

  rotateSecret(organizationId: string, id: string): Promise<RotateOAuthApplicationSecretResult> {
    return this.client.post<RotateOAuthApplicationSecretResult>(
      `/organizations/${organizationId}/oauth-applications/${id}/rotate-secret`,
    );
  }

  suspend(organizationId: string, id: string): Promise<OAuthApplication> {
    return this.client.post<OAuthApplication>(
      `/organizations/${organizationId}/oauth-applications/${id}/suspend`,
    );
  }

  reactivate(organizationId: string, id: string): Promise<OAuthApplication> {
    return this.client.post<OAuthApplication>(
      `/organizations/${organizationId}/oauth-applications/${id}/reactivate`,
    );
  }

  delete(organizationId: string, id: string): Promise<void> {
    return this.client.delete<void>(`/organizations/${organizationId}/oauth-applications/${id}`);
  }

  // --- RFC 6749/7009/7662 token endpoints — called by the app the SDK is
  // embedded in, acting as an OAuth client (not by the organization owner
  // managing the application registration above). ---

  exchangeAuthorizationCode(input: ExchangeAuthorizationCodeInput): Promise<OAuthTokenResponse> {
    return this.client.rawRequest<OAuthTokenResponse>("/oauth/token", {
      method: "POST",
      body: {
        grant_type: "authorization_code",
        code: input.code,
        redirect_uri: input.redirectUri,
        code_verifier: input.codeVerifier,
        client_id: input.clientId,
        client_secret: input.clientSecret,
      },
    });
  }

  refreshToken(input: RefreshOAuthTokenInput): Promise<OAuthTokenResponse> {
    return this.client.rawRequest<OAuthTokenResponse>("/oauth/token", {
      method: "POST",
      body: {
        grant_type: "refresh_token",
        refresh_token: input.refreshToken,
        client_id: input.clientId,
        client_secret: input.clientSecret,
      },
    });
  }

  revokeToken(input: RevokeOAuthTokenInput): Promise<Record<string, never>> {
    return this.client.rawRequest<Record<string, never>>("/oauth/revoke", {
      method: "POST",
      body: {
        token: input.token,
        token_type_hint: input.tokenTypeHint,
        client_id: input.clientId,
        client_secret: input.clientSecret,
      },
    });
  }

  introspectToken(input: IntrospectOAuthTokenInput): Promise<OAuthIntrospectResponse> {
    return this.client.rawRequest<OAuthIntrospectResponse>("/oauth/introspect", {
      method: "POST",
      body: { token: input.token, client_id: input.clientId, client_secret: input.clientSecret },
    });
  }
}
