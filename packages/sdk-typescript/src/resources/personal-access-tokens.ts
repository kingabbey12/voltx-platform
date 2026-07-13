import type { VoltxClient } from "../client.js";
import type { components } from "../generated/schema.js";
import type { CreatePersonalAccessTokenResult, PersonalAccessToken } from "../types.js";

export type CreatePersonalAccessTokenInput = components["schemas"]["CreatePersonalAccessTokenDto"];

/** User-scoped bearer tokens — not bound to one organization (see
 * PersonalAccessTokenGuard; the X-Organization-Id header is supplied by
 * the client's "personal-access-token" auth mode, not per-call here). */
export class PersonalAccessTokensResource {
  constructor(private readonly client: VoltxClient) {}

  list(): Promise<PersonalAccessToken[]> {
    return this.client.get<PersonalAccessToken[]>("/developer/personal-access-tokens");
  }

  create(input: CreatePersonalAccessTokenInput): Promise<CreatePersonalAccessTokenResult> {
    return this.client.post<CreatePersonalAccessTokenResult>("/developer/personal-access-tokens", input);
  }

  revoke(id: string): Promise<void> {
    return this.client.delete<void>(`/developer/personal-access-tokens/${id}`);
  }
}
