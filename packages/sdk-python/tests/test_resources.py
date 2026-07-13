from __future__ import annotations

from conftest import FakeResponse

from voltx_sdk import ApiKeyAuth, OAuthAuth, VoltxClient
from voltx_sdk.generated.schema import CreatePersonalAccessTokenDto
from voltx_sdk.resources.oauth_applications import ExchangeAuthorizationCodeInput


def make_client(session, auth=None) -> VoltxClient:
    return VoltxClient(base_url="https://api.test/api/v1", auth=auth or ApiKeyAuth(api_key="vk_test"), session=session)


def test_personal_access_tokens_create_posts_expected_body(fake_session):
    fake_session.queue_response(
        FakeResponse(201, {"success": True, "data": {"id": "pat-1", "token": "vpat_raw"}, "meta": {}})
    )
    client = make_client(fake_session)

    result = client.personal_access_tokens.create(
        CreatePersonalAccessTokenDto(name="CI script", scopedPermissions=["organization.read"])
    )

    assert result["token"] == "vpat_raw"
    call = fake_session.calls[0]
    assert call["url"] == "https://api.test/api/v1/developer/personal-access-tokens"
    assert call["method"] == "POST"
    assert call["json"] == {"name": "CI script", "scopedPermissions": ["organization.read"]}


def test_service_accounts_suspend_posts_to_org_scoped_path(fake_session):
    fake_session.queue_response(
        FakeResponse(200, {"success": True, "data": {"id": "sa-1", "status": "SUSPENDED"}, "meta": {}})
    )
    client = make_client(fake_session)

    client.service_accounts.suspend("org-1", "sa-1")

    call = fake_session.calls[0]
    assert call["url"] == "https://api.test/api/v1/organizations/org-1/service-accounts/sa-1/suspend"
    assert call["method"] == "POST"


def test_webhook_endpoints_replay_delivery_posts_to_nested_path(fake_session):
    fake_session.queue_response(FakeResponse(201, {"success": True, "data": {"id": "delivery-2"}, "meta": {}}))
    client = make_client(fake_session)

    client.webhook_endpoints.replay_delivery("org-1", "endpoint-1", "delivery-1")

    call = fake_session.calls[0]
    assert (
        call["url"]
        == "https://api.test/api/v1/organizations/org-1/webhook-endpoints/endpoint-1/deliveries/delivery-1/replay"
    )


def test_oauth_applications_exchange_authorization_code_hits_raw_token_endpoint(fake_session):
    fake_session.queue_response(
        FakeResponse(
            200,
            {
                "access_token": "voat_x",
                "token_type": "Bearer",
                "expires_in": 3600,
                "refresh_token": "vort_x",
                "scope": "organization.read",
            },
        )
    )
    client = make_client(fake_session, OAuthAuth(access_token="unused"))

    result = client.oauth_applications.exchange_authorization_code(
        ExchangeAuthorizationCodeInput(
            code="auth-code",
            redirect_uri="https://example.com/callback",
            code_verifier="verifier",
            client_id="client_1",
            client_secret="secret",
        )
    )

    assert result["access_token"] == "voat_x"
    call = fake_session.calls[0]
    assert call["url"] == "https://api.test/api/v1/oauth/token"
    assert call["json"] == {
        "grant_type": "authorization_code",
        "code": "auth-code",
        "redirect_uri": "https://example.com/callback",
        "code_verifier": "verifier",
        "client_id": "client_1",
        "client_secret": "secret",
    }
