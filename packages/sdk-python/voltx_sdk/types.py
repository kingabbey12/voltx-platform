"""Hand-maintained response shapes for the Developer Platform resource
surface. NestJS Swagger cannot resolve the generic `ApiSuccessResponseDto[T]`'s
`data` field to a concrete schema (see backend openapi-3.1.util.ts / Phase 1
notes), so these never appear in the generated OpenAPI document at all —
these TypedDicts are hand-maintained to match the real backend DTOs exactly
(src/modules/developer-platform, src/modules/oauth-provider,
src/modules/webhooks). They're TypedDict (a purely static-typing construct —
a plain dict at runtime) rather than dataclasses, since API responses are
already plain deserialized JSON and need no marshalling step, matching how
the TypeScript SDK's interfaces work structurally over the same JSON.
"""
from __future__ import annotations

from typing import List, Literal, Optional, TypedDict


class PersonalAccessToken(TypedDict):
    id: str
    name: str
    tokenPrefix: str
    scopedPermissions: List[str]
    expiresAt: Optional[str]
    lastUsedAt: Optional[str]
    revokedAt: Optional[str]
    createdAt: str


class CreatePersonalAccessTokenResult(PersonalAccessToken):
    token: str


ServiceAccountStatus = Literal["ACTIVE", "SUSPENDED"]


class ServiceAccount(TypedDict):
    id: str
    name: str
    description: Optional[str]
    status: ServiceAccountStatus
    createdAt: str
    updatedAt: str


class ServiceAccountToken(TypedDict):
    id: str
    name: str
    tokenPrefix: str
    expiresAt: Optional[str]
    lastUsedAt: Optional[str]
    revokedAt: Optional[str]
    createdAt: str


class CreateServiceAccountTokenResult(ServiceAccountToken):
    token: str


OAuthApplicationStatus = Literal["ACTIVE", "SUSPENDED"]


class OAuthApplication(TypedDict):
    id: str
    name: str
    description: Optional[str]
    logoUrl: Optional[str]
    clientId: str
    clientSecretPrefix: str
    scopes: List[str]
    redirectUris: List[str]
    status: OAuthApplicationStatus
    createdAt: str
    updatedAt: str


class CreateOAuthApplicationResult(OAuthApplication):
    clientSecret: str


class RotateOAuthApplicationSecretResult(TypedDict):
    clientSecretPrefix: str
    clientSecret: str


WebhookEndpointStatus = Literal["ACTIVE", "SUSPENDED"]


class WebhookEndpoint(TypedDict):
    id: str
    url: str
    description: Optional[str]
    eventTypes: List[str]
    status: WebhookEndpointStatus
    createdAt: str
    updatedAt: str


class CreateWebhookEndpointResult(WebhookEndpoint):
    secret: str


class RotateWebhookEndpointSecretResult(TypedDict):
    secret: str


WebhookDeliveryStatus = Literal["PENDING", "SUCCEEDED", "FAILED", "EXHAUSTED"]


class WebhookDelivery(TypedDict):
    id: str
    eventType: str
    payload: object
    status: WebhookDeliveryStatus
    responseStatusCode: Optional[int]
    responseBody: Optional[str]
    attemptCount: int
    deliveredAt: Optional[str]
    createdAt: str


class OAuthTokenResponse(TypedDict):
    access_token: str
    token_type: Literal["Bearer"]
    expires_in: int
    refresh_token: str
    scope: str


class OAuthIntrospectResponse(TypedDict, total=False):
    active: bool
    scope: str
    client_id: str
    sub: str
    exp: int
    iat: int
    token_type: Literal["access_token", "refresh_token"]
