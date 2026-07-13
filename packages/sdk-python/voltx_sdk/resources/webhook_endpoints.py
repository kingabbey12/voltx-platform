from __future__ import annotations

from typing import TYPE_CHECKING, List

from ..generated.schema import CreateWebhookEndpointDto, UpdateWebhookEndpointDto
from ..types import (
    CreateWebhookEndpointResult,
    RotateWebhookEndpointSecretResult,
    WebhookDelivery,
    WebhookEndpoint,
)

if TYPE_CHECKING:
    from ..client import VoltxClient


class WebhookEndpointsResource:
    def __init__(self, client: "VoltxClient") -> None:
        self._client = client

    def list(self, organization_id: str) -> List[WebhookEndpoint]:
        return self._client.get(f"/organizations/{organization_id}/webhook-endpoints")

    def create(self, organization_id: str, input: CreateWebhookEndpointDto) -> CreateWebhookEndpointResult:
        return self._client.post(f"/organizations/{organization_id}/webhook-endpoints", input)

    def get(self, organization_id: str, id: str) -> WebhookEndpoint:
        return self._client.get(f"/organizations/{organization_id}/webhook-endpoints/{id}")

    def update(self, organization_id: str, id: str, input: UpdateWebhookEndpointDto) -> WebhookEndpoint:
        return self._client.patch(f"/organizations/{organization_id}/webhook-endpoints/{id}", input)

    def rotate_secret(self, organization_id: str, id: str) -> RotateWebhookEndpointSecretResult:
        return self._client.post(f"/organizations/{organization_id}/webhook-endpoints/{id}/rotate-secret")

    def suspend(self, organization_id: str, id: str) -> WebhookEndpoint:
        return self._client.post(f"/organizations/{organization_id}/webhook-endpoints/{id}/suspend")

    def reactivate(self, organization_id: str, id: str) -> WebhookEndpoint:
        return self._client.post(f"/organizations/{organization_id}/webhook-endpoints/{id}/reactivate")

    def delete(self, organization_id: str, id: str) -> None:
        self._client.delete(f"/organizations/{organization_id}/webhook-endpoints/{id}")

    def list_deliveries(self, organization_id: str, id: str) -> List[WebhookDelivery]:
        return self._client.get(f"/organizations/{organization_id}/webhook-endpoints/{id}/deliveries")

    def replay_delivery(self, organization_id: str, id: str, delivery_id: str) -> WebhookDelivery:
        return self._client.post(
            f"/organizations/{organization_id}/webhook-endpoints/{id}/deliveries/{delivery_id}/replay"
        )
