import '../models/personal_access_token.dart';
import '../voltx_client.dart';

/// User-scoped bearer tokens — not bound to one organization (see
/// PersonalAccessTokenGuard; the X-Organization-Id header is supplied by
/// the client's [PersonalAccessTokenAuth] mode, not per-call here).
class PersonalAccessTokensResource {
  PersonalAccessTokensResource(this._client);
  final VoltxClient _client;

  Future<List<PersonalAccessToken>> list() => _client.requestList(
        '/developer/personal-access-tokens',
        fromJson: PersonalAccessToken.fromJson,
      );

  Future<CreatePersonalAccessTokenResult> create({
    required String name,
    required List<String> scopedPermissions,
    String? expiresAt,
  }) =>
      _client.request(
        '/developer/personal-access-tokens',
        method: 'POST',
        body: {
          'name': name,
          'scopedPermissions': scopedPermissions,
          if (expiresAt != null) 'expiresAt': expiresAt,
        },
        fromJson: CreatePersonalAccessTokenResult.fromJson,
      );

  Future<void> revoke(String id) => _client.requestVoid('/developer/personal-access-tokens/$id');
}
