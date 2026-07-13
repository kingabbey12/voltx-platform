from __future__ import annotations

import hashlib
import hmac
import json

from voltx_sdk import verify_webhook_signature

SECRET = "whsec_test_secret"
RAW_BODY = json.dumps({"eventType": "sales.lead.created", "payload": {"id": "1"}})


def sign(body: str, secret: str = SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def test_accepts_correctly_signed_payload():
    assert verify_webhook_signature(SECRET, RAW_BODY, sign(RAW_BODY)) is True


def test_rejects_wrong_secret():
    assert verify_webhook_signature(SECRET, RAW_BODY, sign(RAW_BODY, "wrong-secret")) is False


def test_rejects_tampered_body():
    tampered = json.dumps({"eventType": "sales.lead.created", "payload": {"id": "2"}})
    assert verify_webhook_signature(SECRET, tampered, sign(RAW_BODY)) is False


def test_rejects_malformed_signature_header():
    assert verify_webhook_signature(SECRET, RAW_BODY, "not-a-signature") is False
