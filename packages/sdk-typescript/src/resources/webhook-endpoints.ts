import type { VoltxClient } from "../client.js";
import type { components } from "../generated/schema.js";
import type {
  CreateWebhookEndpointResult,
  RotateWebhookEndpointSecretResult,
  WebhookDelivery,
  WebhookEndpoint,
} from "../types.js";

export type CreateWebhookEndpointInput = components["schemas"]["CreateWebhookEndpointDto"];
export type UpdateWebhookEndpointInput = components["schemas"]["UpdateWebhookEndpointDto"];

export class WebhookEndpointsResource {
  constructor(private readonly client: VoltxClient) {}

  list(organizationId: string): Promise<WebhookEndpoint[]> {
    return this.client.get<WebhookEndpoint[]>(`/organizations/${organizationId}/webhook-endpoints`);
  }

  create(organizationId: string, input: CreateWebhookEndpointInput): Promise<CreateWebhookEndpointResult> {
    return this.client.post<CreateWebhookEndpointResult>(
      `/organizations/${organizationId}/webhook-endpoints`,
      input,
    );
  }

  get(organizationId: string, id: string): Promise<WebhookEndpoint> {
    return this.client.get<WebhookEndpoint>(`/organizations/${organizationId}/webhook-endpoints/${id}`);
  }

  update(organizationId: string, id: string, input: UpdateWebhookEndpointInput): Promise<WebhookEndpoint> {
    return this.client.patch<WebhookEndpoint>(
      `/organizations/${organizationId}/webhook-endpoints/${id}`,
      input,
    );
  }

  rotateSecret(organizationId: string, id: string): Promise<RotateWebhookEndpointSecretResult> {
    return this.client.post<RotateWebhookEndpointSecretResult>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/rotate-secret`,
    );
  }

  suspend(organizationId: string, id: string): Promise<WebhookEndpoint> {
    return this.client.post<WebhookEndpoint>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/suspend`,
    );
  }

  reactivate(organizationId: string, id: string): Promise<WebhookEndpoint> {
    return this.client.post<WebhookEndpoint>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/reactivate`,
    );
  }

  delete(organizationId: string, id: string): Promise<void> {
    return this.client.delete<void>(`/organizations/${organizationId}/webhook-endpoints/${id}`);
  }

  listDeliveries(organizationId: string, id: string): Promise<WebhookDelivery[]> {
    return this.client.get<WebhookDelivery[]>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/deliveries`,
    );
  }

  replayDelivery(organizationId: string, id: string, deliveryId: string): Promise<WebhookDelivery> {
    return this.client.post<WebhookDelivery>(
      `/organizations/${organizationId}/webhook-endpoints/${id}/deliveries/${deliveryId}/replay`,
    );
  }
}
