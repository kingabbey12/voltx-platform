from __future__ import annotations

import pytest

from conftest import FakeResponse
from voltx_sdk import ApiKeyAuth, OAuthAuth, PersonalAccessTokenAuth, VoltxApiError, VoltxClient


def make_client(session, auth=None) -> VoltxClient:
    return VoltxClient(
        base_url="https://api.test/api/v1",
        auth=auth or ApiKeyAuth(api_key="vk_test"),
        session=session,
    )


class TestAuthHeaderInjection:
    def test_api_key_sends_x_api_key(self, fake_session):
        fake_session.queue_response(FakeResponse(200, {"success": True, "data": [], "meta": {}}))
        client = make_client(fake_session, ApiKeyAuth(api_key="vk_test123"))

        client.get("/anything")

        assert fake_session.calls[0]["headers"]["X-Api-Key"] == "vk_test123"

    def test_personal_access_token_sends_both_headers(self, fake_session):
        fake_session.queue_response(FakeResponse(200, {"success": True, "data": [], "meta": {}}))
        client = make_client(
            fake_session, PersonalAccessTokenAuth(token="vpat_abc", organization_id="org-1")
        )

        client.get("/anything")

        headers = fake_session.calls[0]["headers"]
        assert headers["X-Personal-Access-Token"] == "vpat_abc"
        assert headers["X-Organization-Id"] == "org-1"

    def test_oauth_sends_bearer(self, fake_session):
        fake_session.queue_response(FakeResponse(200, {"success": True, "data": [], "meta": {}}))
        client = make_client(fake_session, OAuthAuth(access_token="voat_xyz"))

        client.get("/anything")

        assert fake_session.calls[0]["headers"]["Authorization"] == "Bearer voat_xyz"


class TestEnvelopeUnwrapping:
    def test_returns_unwrapped_data_on_success(self, fake_session):
        fake_session.queue_response(
            FakeResponse(200, {"success": True, "data": {"id": "pat-1"}, "meta": {}})
        )
        client = make_client(fake_session)

        result = client.get("/developer/personal-access-tokens")

        assert result == {"id": "pat-1"}


class TestErrorMapping:
    def test_raises_voltx_api_error_with_code_and_message(self, fake_session):
        fake_session.queue_response(
            FakeResponse(
                403,
                {
                    "success": False,
                    "error": {"code": "FORBIDDEN", "message": "Missing required permissions"},
                    "meta": {},
                },
            )
        )
        client = make_client(fake_session)

        with pytest.raises(VoltxApiError) as exc_info:
            client.get("/organizations/org-1/service-accounts")

        error = exc_info.value
        assert error.status_code == 403
        assert error.code == "FORBIDDEN"
        assert error.is_forbidden is True


class TestOAuthRetryOn401:
    def test_refreshes_once_and_retries(self, fake_session):
        calls = {"count": 0}

        def handler(method, url, headers=None, json=None, params=None):
            calls["count"] += 1
            if calls["count"] == 1:
                return FakeResponse(
                    401,
                    {"success": False, "error": {"code": "UNAUTHORIZED", "message": "Expired"}, "meta": {}},
                )
            if url.endswith("/oauth/token"):
                return FakeResponse(
                    200,
                    {
                        "access_token": "voat_new",
                        "token_type": "Bearer",
                        "expires_in": 3600,
                        "refresh_token": "vort_new",
                        "scope": "organization.read",
                    },
                )
            return FakeResponse(200, {"success": True, "data": {"ok": True}, "meta": {}})

        fake_session._handler = handler
        refreshed = {}
        client = make_client(
            fake_session,
            OAuthAuth(
                access_token="voat_stale",
                refresh_token="vort_stale",
                client_id="client_1",
                client_secret="vcs_secret",
                on_tokens_refreshed=lambda tokens: refreshed.update(tokens),
            ),
        )

        result = client.get("/oauth/whoami")

        assert result == {"ok": True}
        assert calls["count"] == 3
        assert refreshed["access_token"] == "voat_new"

    def test_does_not_retry_without_refresh_token(self, fake_session):
        fake_session.queue_response(
            FakeResponse(401, {"success": False, "error": {"code": "UNAUTHORIZED", "message": "x"}, "meta": {}})
        )
        client = make_client(fake_session, OAuthAuth(access_token="voat_stale"))

        with pytest.raises(VoltxApiError):
            client.get("/oauth/whoami")

        assert len(fake_session.calls) == 1
