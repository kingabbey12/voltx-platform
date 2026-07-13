import 'package:dio/dio.dart';
import 'package:test/test.dart';
import 'package:voltx_sdk/voltx_sdk.dart';

import 'fake_adapter.dart';

VoltxClient makeClient(FakeHttpClientAdapter adapter, {VoltxAuth? auth}) {
  final dio = Dio(BaseOptions(baseUrl: 'https://api.test/api/v1', validateStatus: (_) => true));
  dio.httpClientAdapter = adapter;
  return VoltxClient(baseUrl: 'https://api.test/api/v1', auth: auth ?? const ApiKeyAuth('vk_test'), dio: dio);
}

void main() {
  test('personalAccessTokens.create POSTs to /developer/personal-access-tokens', () async {
    final adapter = FakeHttpClientAdapter()
      ..queueJson(201, {
        'success': true,
        'data': {
          'id': 'pat-1',
          'name': 'CI script',
          'tokenPrefix': 'vpat_ab...',
          'scopedPermissions': ['organization.read'],
          'expiresAt': null,
          'lastUsedAt': null,
          'revokedAt': null,
          'createdAt': '2026-01-01T00:00:00.000Z',
          'token': 'vpat_raw',
        },
        'meta': {},
      });
    final client = makeClient(adapter);

    final result = await client.personalAccessTokens.create(
      name: 'CI script',
      scopedPermissions: ['organization.read'],
    );

    expect(result.token, 'vpat_raw');
    final call = adapter.calls.single;
    expect(call.url, 'https://api.test/api/v1/developer/personal-access-tokens');
    expect(call.method, 'POST');
    expect(call.body, {'name': 'CI script', 'scopedPermissions': ['organization.read']});
  });

  test('serviceAccounts.suspend POSTs to the org-scoped suspend path', () async {
    final adapter = FakeHttpClientAdapter()
      ..queueJson(200, {
        'success': true,
        'data': {
          'id': 'sa-1',
          'name': 'CI',
          'description': null,
          'status': 'SUSPENDED',
          'createdAt': '2026-01-01T00:00:00.000Z',
          'updatedAt': '2026-01-01T00:00:00.000Z',
        },
        'meta': {},
      });
    final client = makeClient(adapter);

    await client.serviceAccounts.suspend('org-1', 'sa-1');

    final call = adapter.calls.single;
    expect(call.url, 'https://api.test/api/v1/organizations/org-1/service-accounts/sa-1/suspend');
    expect(call.method, 'POST');
  });

  test('webhookEndpoints.replayDelivery POSTs to the nested replay path', () async {
    final adapter = FakeHttpClientAdapter()
      ..queueJson(201, {
        'success': true,
        'data': {
          'id': 'delivery-2',
          'eventType': 'sales.lead.created',
          'payload': {},
          'status': 'PENDING',
          'responseStatusCode': null,
          'responseBody': null,
          'attemptCount': 0,
          'deliveredAt': null,
          'createdAt': '2026-01-01T00:00:00.000Z',
        },
        'meta': {},
      });
    final client = makeClient(adapter);

    await client.webhookEndpoints.replayDelivery('org-1', 'endpoint-1', 'delivery-1');

    final call = adapter.calls.single;
    expect(
      call.url,
      'https://api.test/api/v1/organizations/org-1/webhook-endpoints/endpoint-1/deliveries/delivery-1/replay',
    );
  });

  test('oauthApplications.exchangeAuthorizationCode hits the raw (un-enveloped) /oauth/token endpoint', () async {
    final adapter = FakeHttpClientAdapter()
      ..queueJson(200, {
        'access_token': 'voat_x',
        'token_type': 'Bearer',
        'expires_in': 3600,
        'refresh_token': 'vort_x',
        'scope': 'organization.read',
      });
    final client = makeClient(adapter, auth: OAuthAuth(accessToken: 'unused'));

    final result = await client.oauthApplications.exchangeAuthorizationCode(
      code: 'auth-code',
      redirectUri: 'https://example.com/callback',
      codeVerifier: 'verifier',
      clientId: 'client_1',
      clientSecret: 'secret',
    );

    expect(result.accessToken, 'voat_x');
    final call = adapter.calls.single;
    expect(call.url, 'https://api.test/api/v1/oauth/token');
    expect(call.body, {
      'grant_type': 'authorization_code',
      'code': 'auth-code',
      'redirect_uri': 'https://example.com/callback',
      'code_verifier': 'verifier',
      'client_id': 'client_1',
      'client_secret': 'secret',
    });
  });
}
