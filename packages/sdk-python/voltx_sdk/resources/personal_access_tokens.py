from __future__ import annotations

from typing import TYPE_CHECKING, List

from ..generated.schema import CreatePersonalAccessTokenDto
from ..types import CreatePersonalAccessTokenResult, PersonalAccessToken

if TYPE_CHECKING:
    from ..client import VoltxClient


class PersonalAccessTokensResource:
    """User-scoped bearer tokens — not bound to one organization (see
    PersonalAccessTokenGuard; the X-Organization-Id header is supplied by
    the client's PersonalAccessTokenAuth mode, not per-call here)."""

    def __init__(self, client: "VoltxClient") -> None:
        self._client = client

    def list(self) -> List[PersonalAccessToken]:
        return self._client.get("/developer/personal-access-tokens")

    def create(self, input: CreatePersonalAccessTokenDto) -> CreatePersonalAccessTokenResult:
        return self._client.post("/developer/personal-access-tokens", input)

    def revoke(self, id: str) -> None:
        self._client.delete(f"/developer/personal-access-tokens/{id}")
