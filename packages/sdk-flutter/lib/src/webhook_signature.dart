import 'dart:convert';

import 'package:crypto/crypto.dart';

/// Verifies an inbound Voltx webhook delivery's `X-Voltx-Signature` header
/// (`sha256=<hex>` over the exact raw request body) against the endpoint's
/// own signing secret — mirrors the backend's signing scheme exactly
/// (src/common/utils/hmac.util.ts). Always verify against the raw body
/// bytes/string as received, before any JSON re-serialization, since
/// re-serializing can change byte-for-byte formatting and break the check.
bool verifyWebhookSignature(String secret, String rawBody, String signatureHeader) {
  final digest = Hmac(sha256, utf8.encode(secret)).convert(utf8.encode(rawBody));
  final expected = 'sha256=$digest';

  final expectedBytes = utf8.encode(expected);
  final actualBytes = utf8.encode(signatureHeader);
  if (expectedBytes.length != actualBytes.length) return false;

  // Constant-time comparison — never short-circuit on the first mismatch.
  var diff = 0;
  for (var i = 0; i < expectedBytes.length; i++) {
    diff |= expectedBytes[i] ^ actualBytes[i];
  }
  return diff == 0;
}
