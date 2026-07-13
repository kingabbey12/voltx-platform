from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, List, Optional

from ..generated.schema import CreateOAuthApplicationDto, UpdateOAuthApplicationDto
from ..types import (
    CreateOAuthApplicationResult,
    OAuthApplication,
    OAuthIntrospectResponse,
    OAuthTokenResponse,
    RotateOAuthApplicationSecretResult,
)

if TYPE_CHECKING:
    from ..client import VoltxClient


@dataclass
class ExchangeAuthorizationCodeInput:
    code: str
    redirect_uri: str
    code_verifier: str
    client_id: str
    client_secret: str


@dataclass
class RefreshOAuthTokenInput:
    refresh_token: str
    client_id: str
    client_secret: str


@dataclass
class RevokeOAuthTokenInput:
    token: str
    client_id: str
    client_secret: str
    token_type_hint: Optional[str] = None


@dataclass
class IntrospectOAuthTokenInput:
    token: str
    client_id: str
    client_secret: str


class OAuthApplicationsResource:
    def __init__(self, client: "VoltxClient") -> None:
        self._client = client

    def list(self, organization_id: str) -> List[OAuthApplication]:
        return self._client.get(f"/organizations/{organization_id}/oauth-applications")

    def create(self, organization_id: str, input: CreateOAuthApplicationDto) -> CreateOAuthApplicationResult:
        return self._client.post(f"/organizations/{organization_id}/oauth-applications", input)

    def get(self, organization_id: str, id: str) -> OAuthApplication:
        return self._client.get(f"/organizations/{organization_id}/oauth-applications/{id}")

    def update(self, organization_id: str, id: str, input: UpdateOAuthApplicationDto) -> OAuthApplication:
        return self._client.patch(f"/organizations/{organization_id}/oauth-applications/{id}", input)

    def rotate_secret(self, organization_id: str, id: str) -> RotateOAuthApplicationSecretResult:
        return self._client.post(f"/organizations/{organization_id}/oauth-applications/{id}/rotate-secret")

    def suspend(self, organization_id: str, id: str) -> OAuthApplication:
        return self._client.post(f"/organizations/{organization_id}/oauth-applications/{id}/suspend")

    def reactivate(self, organization_id: str, id: str) -> OAuthApplication:
        return self._client.post(f"/organizations/{organization_id}/oauth-applications/{id}/reactivate")

    def delete(self, organization_id: str, id: str) -> None:
        self._client.delete(f"/organizations/{organization_id}/oauth-applications/{id}")

    # --- RFC 6749/7009/7662 token endpoints — called by the app the SDK is
    # embedded in, acting as an OAuth client (not by the organization owner
    # managing the application registration above). ---

    def exchange_authorization_code(self, input: ExchangeAuthorizationCodeInput) -> OAuthTokenResponse:
        return self._client.raw_request(
            "/oauth/token",
            method="POST",
            body={
                "grant_type": "authorization_code",
                "code": input.code,
                "redirect_uri": input.redirect_uri,
                "code_verifier": input.code_verifier,
                "client_id": input.client_id,
                "client_secret": input.client_secret,
            },
        )

    def refresh_token(self, input: RefreshOAuthTokenInput) -> OAuthTokenResponse:
        return self._client.raw_request(
            "/oauth/token",
            method="POST",
            body={
                "grant_type": "refresh_token",
                "refresh_token": input.refresh_token,
                "client_id": input.client_id,
                "client_secret": input.client_secret,
            },
        )

    def revoke_token(self, input: RevokeOAuthTokenInput) -> dict:
        return self._client.raw_request(
            "/oauth/revoke",
            method="POST",
            body={
                "token": input.token,
                "token_type_hint": input.token_type_hint,
                "client_id": input.client_id,
                "client_secret": input.client_secret,
            },
        )

    def introspect_token(self, input: IntrospectOAuthTokenInput) -> OAuthIntrospectResponse:
        return self._client.raw_request(
            "/oauth/introspect",
            method="POST",
            body={"token": input.token, "client_id": input.client_id, "client_secret": input.client_secret},
        )
