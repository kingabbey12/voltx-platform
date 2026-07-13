import type { VoltxClient } from "../client.js";
import type { components } from "../generated/schema.js";
import type { CreateServiceAccountTokenResult, ServiceAccount, ServiceAccountToken } from "../types.js";

export type CreateServiceAccountInput = components["schemas"]["CreateServiceAccountDto"];
export type CreateServiceAccountTokenInput = components["schemas"]["CreateServiceAccountTokenDto"];

export class ServiceAccountsResource {
  constructor(private readonly client: VoltxClient) {}

  list(organizationId: string): Promise<ServiceAccount[]> {
    return this.client.get<ServiceAccount[]>(`/organizations/${organizationId}/service-accounts`);
  }

  create(organizationId: string, input: CreateServiceAccountInput): Promise<ServiceAccount> {
    return this.client.post<ServiceAccount>(`/organizations/${organizationId}/service-accounts`, input);
  }

  get(organizationId: string, id: string): Promise<ServiceAccount> {
    return this.client.get<ServiceAccount>(`/organizations/${organizationId}/service-accounts/${id}`);
  }

  suspend(organizationId: string, id: string): Promise<ServiceAccount> {
    return this.client.post<ServiceAccount>(
      `/organizations/${organizationId}/service-accounts/${id}/suspend`,
    );
  }

  reactivate(organizationId: string, id: string): Promise<ServiceAccount> {
    return this.client.post<ServiceAccount>(
      `/organizations/${organizationId}/service-accounts/${id}/reactivate`,
    );
  }

  listTokens(organizationId: string, id: string): Promise<ServiceAccountToken[]> {
    return this.client.get<ServiceAccountToken[]>(
      `/organizations/${organizationId}/service-accounts/${id}/tokens`,
    );
  }

  createToken(
    organizationId: string,
    id: string,
    input: CreateServiceAccountTokenInput,
  ): Promise<CreateServiceAccountTokenResult> {
    return this.client.post<CreateServiceAccountTokenResult>(
      `/organizations/${organizationId}/service-accounts/${id}/tokens`,
      input,
    );
  }

  revokeToken(organizationId: string, id: string, tokenId: string): Promise<void> {
    return this.client.delete<void>(
      `/organizations/${organizationId}/service-accounts/${id}/tokens/${tokenId}`,
    );
  }
}
