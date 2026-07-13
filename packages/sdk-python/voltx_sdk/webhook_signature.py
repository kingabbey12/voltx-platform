"""Verifies an inbound Voltx webhook delivery's `X-Voltx-Signature` header
(`sha256=<hex>` over the exact raw request body) against the endpoint's own
signing secret — mirrors the backend's signing scheme exactly
(src/common/utils/hmac.util.ts). Always verify against the raw body
bytes/string as received, before any JSON re-serialization, since
re-serializing can change byte-for-byte formatting and break the check.
"""
from __future__ import annotations

import hashlib
import hmac


def verify_webhook_signature(secret: str, raw_body: str, signature_header: str) -> bool:
    expected = "sha256=" + hmac.new(secret.encode("utf-8"), raw_body.encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)
