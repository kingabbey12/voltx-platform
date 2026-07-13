from __future__ import annotations

import dataclasses
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional, Union
from urllib.parse import urljoin

import requests

from .errors import VoltxApiError
from .types import OAuthTokenResponse


@dataclass
class ApiKeyAuth:
    api_key: str


@dataclass
class PersonalAccessTokenAuth:
    token: str
    organization_id: str


@dataclass
class ServiceAccountTokenAuth:
    token: str


@dataclass
class OAuthAuth:
    access_token: str
    # Enables the automatic retry-on-401 refresh flow below.
    refresh_token: Optional[str] = None
    client_id: Optional[str] = None
    client_secret: Optional[str] = None
    on_tokens_refreshed: Optional[Callable[[OAuthTokenResponse], None]] = None


VoltxAuth = Union[ApiKeyAuth, PersonalAccessTokenAuth, ServiceAccountTokenAuth, OAuthAuth]


def _to_json_body(body: Any) -> Any:
    if body is None:
        return None
    if dataclasses.is_dataclass(body):
        return {key: value for key, value in dataclasses.asdict(body).items() if value is not None}
    return body


class VoltxClient:
    """One of every credential type the backend accepts (see AUTH_GUARDS
    alternatives across src/modules/security, developer-platform, and
    oauth-provider) — the client picks the matching header(s) for whichever
    auth mode is configured.
    """

    def __init__(self, base_url: str, auth: VoltxAuth, session: Optional[requests.Session] = None) -> None:
        self.base_url = base_url.rstrip("/")
        self.auth = auth
        self.session = session or requests.Session()

        from .resources.oauth_applications import OAuthApplicationsResource
        from .resources.personal_access_tokens import PersonalAccessTokensResource
        from .resources.service_accounts import ServiceAccountsResource
        from .resources.webhook_endpoints import WebhookEndpointsResource

        self.personal_access_tokens = PersonalAccessTokensResource(self)
        self.service_accounts = ServiceAccountsResource(self)
        self.oauth_applications = OAuthApplicationsResource(self)
        self.webhook_endpoints = WebhookEndpointsResource(self)

    def _build_url(self, path: str) -> str:
        return urljoin(self.base_url + "/", path.lstrip("/"))

    def _auth_headers(self) -> Dict[str, str]:
        if isinstance(self.auth, ApiKeyAuth):
            return {"X-Api-Key": self.auth.api_key}
        if isinstance(self.auth, PersonalAccessTokenAuth):
            return {
                "X-Personal-Access-Token": self.auth.token,
                "X-Organization-Id": self.auth.organization_id,
            }
        if isinstance(self.auth, ServiceAccountTokenAuth):
            return {"X-Service-Account-Token": self.auth.token}
        if isinstance(self.auth, OAuthAuth):
            return {"Authorization": f"Bearer {self.auth.access_token}"}
        raise TypeError(f"Unknown auth type: {type(self.auth)!r}")

    def _refresh_oauth_access_token(self) -> None:
        if not isinstance(self.auth, OAuthAuth) or not (
            self.auth.refresh_token and self.auth.client_id and self.auth.client_secret
        ):
            raise VoltxApiError(
                "Cannot refresh: auth is not OAuthAuth, or refresh_token/client_id/client_secret is missing",
                401,
            )

        response = self.session.post(
            self._build_url("/oauth/token"),
            json={
                "grant_type": "refresh_token",
                "refresh_token": self.auth.refresh_token,
                "client_id": self.auth.client_id,
                "client_secret": self.auth.client_secret,
            },
        )
        body = response.json()
        if not response.ok or "access_token" not in body:
            raise VoltxApiError(
                body.get("error_description", "OAuth token refresh failed"),
                response.status_code,
                body.get("error"),
            )

        self.auth.access_token = body["access_token"]
        self.auth.refresh_token = body["refresh_token"]
        if self.auth.on_tokens_refreshed:
            self.auth.on_tokens_refreshed(body)

    def raw_request(
        self,
        path: str,
        method: str = "GET",
        body: Any = None,
        query: Optional[Dict[str, Any]] = None,
    ) -> Any:
        """Used for the three raw RFC 6749/7009/7662 OAuth endpoints, which
        return un-enveloped JSON rather than {success,data,meta}."""
        response = self.session.request(method, self._build_url(path), json=_to_json_body(body), params=query)
        json_body = response.json()
        if not response.ok:
            raise VoltxApiError(
                json_body.get("error_description", "Request failed"),
                response.status_code,
                json_body.get("error"),
            )
        return json_body

    def request(
        self,
        path: str,
        method: str = "GET",
        body: Any = None,
        query: Optional[Dict[str, Any]] = None,
        _is_retry: bool = False,
    ) -> Any:
        headers = {"Accept": "application/json", **self._auth_headers()}
        try:
            response = self.session.request(
                method,
                self._build_url(path),
                headers=headers,
                json=_to_json_body(body),
                params=query,
            )
        except requests.RequestException as error:
            raise VoltxApiError(f"Network request failed: {error}", None) from error

        json_body: Optional[dict] = None
        try:
            json_body = response.json()
        except ValueError:
            pass  # No JSON body (e.g. a 204) — fine for success responses.

        if response.ok and json_body and json_body.get("success"):
            return json_body["data"]

        if response.status_code == 401 and isinstance(self.auth, OAuthAuth) and self.auth.refresh_token and not _is_retry:
            self._refresh_oauth_access_token()
            return self.request(path, method=method, body=body, query=query, _is_retry=True)

        error_envelope = json_body if json_body and not json_body.get("success") else None
        error = (error_envelope or {}).get("error", {})
        raise VoltxApiError(
            error.get("message", f"Request failed with status {response.status_code}"),
            response.status_code,
            error.get("code"),
            error.get("details"),
        )

    def get(self, path: str, query: Optional[Dict[str, Any]] = None) -> Any:
        return self.request(path, method="GET", query=query)

    def post(self, path: str, body: Any = None, query: Optional[Dict[str, Any]] = None) -> Any:
        return self.request(path, method="POST", body=body, query=query)

    def patch(self, path: str, body: Any = None, query: Optional[Dict[str, Any]] = None) -> Any:
        return self.request(path, method="PATCH", body=body, query=query)

    def delete(self, path: str, query: Optional[Dict[str, Any]] = None) -> Any:
        return self.request(path, method="DELETE", query=query)
