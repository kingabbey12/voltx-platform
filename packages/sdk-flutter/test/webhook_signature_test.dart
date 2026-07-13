import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:test/test.dart';
import 'package:voltx_sdk/voltx_sdk.dart';

void main() {
  const secret = 'whsec_test_secret';
  final rawBody = jsonEncode({
    'eventType': 'sales.lead.created',
    'payload': {'id': '1'},
  });

  String sign(String body, {String withSecret = secret}) {
    final digest = Hmac(sha256, utf8.encode(withSecret)).convert(utf8.encode(body));
    return 'sha256=$digest';
  }

  test('accepts a correctly signed payload', () {
    expect(verifyWebhookSignature(secret, rawBody, sign(rawBody)), isTrue);
  });

  test('rejects a signature computed with the wrong secret', () {
    expect(verifyWebhookSignature(secret, rawBody, sign(rawBody, withSecret: 'wrong-secret')), isFalse);
  });

  test('rejects a tampered body', () {
    final tampered = jsonEncode({
      'eventType': 'sales.lead.created',
      'payload': {'id': '2'},
    });
    expect(verifyWebhookSignature(secret, tampered, sign(rawBody)), isFalse);
  });

  test('rejects a malformed signature header', () {
    expect(verifyWebhookSignature(secret, rawBody, 'not-a-signature'), isFalse);
  });
}
