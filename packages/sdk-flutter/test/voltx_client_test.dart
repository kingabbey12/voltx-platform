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
  group('VoltxClient — auth header injection', () {
    test('sends X-Api-Key for ApiKeyAuth', () async {
      final adapter = FakeHttpClientAdapter()..queueJson(200, {'success': true, 'data': <dynamic>[], 'meta': {}});
      final client = makeClient(adapter, auth: const ApiKeyAuth('vk_test123'));

      await client.personalAccessTokens.list();

      expect(adapter.calls.single.headers['X-Api-Key'], 'vk_test123');
    });

    test('sends X-Personal-Access-Token and X-Organization-Id for PersonalAccessTokenAuth', () async {
      final adapter = FakeHttpClientAdapter()..queueJson(200, {'success': true, 'data': <dynamic>[], 'meta': {}});
      final client = makeClient(
        adapter,
        auth: const PersonalAccessTokenAuth(token: 'vpat_abc', organizationId: 'org-1'),
      );

      await client.personalAccessTokens.list();

      expect(adapter.calls.single.headers['X-Personal-Access-Token'], 'vpat_abc');
      expect(adapter.calls.single.headers['X-Organization-Id'], 'org-1');
    });

    test('sends Authorization: Bearer for OAuthAuth', () async {
      final adapter = FakeHttpClientAdapter()..queueJson(200, {'success': true, 'data': <dynamic>[], 'meta': {}});
      final client = makeClient(adapter, auth: OAuthAuth(accessToken: 'voat_xyz'));

      await client.personalAccessTokens.list();

      expect(adapter.calls.single.headers['Authorization'], 'Bearer voat_xyz');
    });
  });

  group('VoltxClient — envelope unwrapping', () {
    test('returns the unwrapped data on a successful envelope', () async {
      final adapter = FakeHttpClientAdapter()
        ..queueJson(200, {
          'success': true,
          'data': {
            'id': 'pat-1',
            'name': 'x',
            'tokenPrefix': 'vpat_ab...',
            'scopedPermissions': ['organization.read'],
            'expiresAt': null,
            'lastUsedAt': null,
            'revokedAt': null,
            'createdAt': '2026-01-01T00:00:00.000Z',
          },
          'meta': {},
        });
      final client = makeClient(adapter);

      final result = await client.request(
        '/developer/personal-access-tokens/pat-1',
        fromJson: PersonalAccessToken.fromJson,
      );

      expect(result.id, 'pat-1');
    });
  });

  group('VoltxClient — error mapping', () {
    test('throws VoltxApiError with the envelope error code/message on failure', () async {
      final adapter = FakeHttpClientAdapter()
        ..queueJson(403, {
          'success': false,
          'error': {'code': 'FORBIDDEN', 'message': 'Missing required permissions'},
          'meta': {},
        });
      final client = makeClient(adapter);

      await expectLater(
        client.personalAccessTokens.list(),
        throwsA(
          isA<VoltxApiError>()
              .having((e) => e.statusCode, 'statusCode', 403)
              .having((e) => e.code, 'code', 'FORBIDDEN')
              .having((e) => e.isForbidden, 'isForbidden', true),
        ),
      );
    });
  });

  group('VoltxClient — OAuth retry-on-401', () {
    test('refreshes the access token exactly once and retries the original request', () async {
      var call = 0;
      Map<String, dynamic>? refreshedTokens;
      final adapter = FakeHttpClientAdapter(
        handler: (options) {
          call += 1;
          if (call == 1) {
            return ResponseBody.fromString(
              '{"success":false,"error":{"code":"UNAUTHORIZED","message":"Expired"},"meta":{}}',
              401,
              headers: {
                Headers.contentTypeHeader: [Headers.jsonContentType],
              },
            );
          }
          if (options.path.endsWith('/oauth/token')) {
            return ResponseBody.fromString(
              '{"access_token":"voat_new","token_type":"Bearer","expires_in":3600,"refresh_token":"vort_new","scope":"organization.read"}',
              200,
              headers: {
                Headers.contentTypeHeader: [Headers.jsonContentType],
              },
            );
          }
          return ResponseBody.fromString(
            '{"success":true,"data":[],"meta":{}}',
            200,
            headers: {
              Headers.contentTypeHeader: [Headers.jsonContentType],
            },
          );
        },
      );

      final client = makeClient(
        adapter,
        auth: OAuthAuth(
          accessToken: 'voat_stale',
          refreshToken: 'vort_stale',
          clientId: 'client_1',
          clientSecret: 'vcs_secret',
          onTokensRefreshed: (tokens) {
            refreshedTokens = {'access_token': tokens.accessToken};
          },
        ),
      );

      final result = await client.personalAccessTokens.list();

      expect(result, isEmpty);
      expect(call, 3);
      expect(refreshedTokens?['access_token'], 'voat_new');
    });

    test('does not attempt a refresh when no refreshToken is configured', () async {
      final adapter = FakeHttpClientAdapter()
        ..queueJson(401, {
          'success': false,
          'error': {'code': 'UNAUTHORIZED', 'message': 'x'},
          'meta': {},
        });
      final client = makeClient(adapter, auth: OAuthAuth(accessToken: 'voat_stale'));

      await expectLater(client.personalAccessTokens.list(), throwsA(isA<VoltxApiError>()));
      expect(adapter.calls, hasLength(1));
    });
  });
}
