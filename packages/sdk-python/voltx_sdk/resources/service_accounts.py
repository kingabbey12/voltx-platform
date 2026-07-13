from __future__ import annotations

from typing import TYPE_CHECKING, List

from ..generated.schema import CreateServiceAccountDto, CreateServiceAccountTokenDto
from ..types import CreateServiceAccountTokenResult, ServiceAccount, ServiceAccountToken

if TYPE_CHECKING:
    from ..client import VoltxClient


class ServiceAccountsResource:
    def __init__(self, client: "VoltxClient") -> None:
        self._client = client

    def list(self, organization_id: str) -> List[ServiceAccount]:
        return self._client.get(f"/organizations/{organization_id}/service-accounts")

    def create(self, organization_id: str, input: CreateServiceAccountDto) -> ServiceAccount:
        return self._client.post(f"/organizations/{organization_id}/service-accounts", input)

    def get(self, organization_id: str, id: str) -> ServiceAccount:
        return self._client.get(f"/organizations/{organization_id}/service-accounts/{id}")

    def suspend(self, organization_id: str, id: str) -> ServiceAccount:
        return self._client.post(f"/organizations/{organization_id}/service-accounts/{id}/suspend")

    def reactivate(self, organization_id: str, id: str) -> ServiceAccount:
        return self._client.post(f"/organizations/{organization_id}/service-accounts/{id}/reactivate")

    def list_tokens(self, organization_id: str, id: str) -> List[ServiceAccountToken]:
        return self._client.get(f"/organizations/{organization_id}/service-accounts/{id}/tokens")

    def create_token(
        self, organization_id: str, id: str, input: CreateServiceAccountTokenDto
    ) -> CreateServiceAccountTokenResult:
        return self._client.post(f"/organizations/{organization_id}/service-accounts/{id}/tokens", input)

    def revoke_token(self, organization_id: str, id: str, token_id: str) -> None:
        self._client.delete(f"/organizations/{organization_id}/service-accounts/{id}/tokens/{token_id}")
